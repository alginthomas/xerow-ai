"""
Core Agent Logic - Xerow AI Industrial Platform
Uses OpenAI GPT-4o for LLM reasoning with function calling.
"""

import json
import logging
import os
import time
from typing import List, Dict, Any, Optional, Generator

from openai import OpenAI

from tools import TOOLS
from tool_handlers import execute_tool

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MODEL = os.environ.get("OPENAI_MODEL_NAME", "gpt-4o")

SYSTEM_PROMPT = (
    "You are Xerow AI, an industrial monitoring assistant for oil and gas operations. "
    "You help field operators, field managers, and chief operators monitor assets, investigate anomalies, "
    "manage tickets, and maintain safe operations across turbines, pipelines, and wells.\n\n"
    "SEVERITY LEVELS:\n"
    "- GREEN: Minor deviation (<=5%), logged only, no ticket\n"
    "- AMBER: Moderate deviation (5-15%), ticket assigned to field operator (Tom), 2h SLA\n"
    "- RED: Significant deviation (>15%) or hard threshold breach, immediate attention, 30min SLA\n"
    "- PURPLE: Unclassifiable pattern, chief operator (Harry) paged immediately\n\n"
    "ESCALATION CHAIN: Tom (Field Operator) -> Dick (Field Manager) -> Harry (Chief Operator)\n\n"
    "BEHAVIOR:\n"
    "- Be concise and action-oriented for field operators\n"
    "- Provide executive summaries for chief operators\n"
    "- Always include severity context when discussing anomalies or tickets\n"
    "- When reporting ticket status, always mention SLA deadline\n"
    "- Never fabricate data - only use tool results\n"
    "- Use query_assets to find assets, get_asset_detail for specifics\n"
    "- Use get_sensor_readings when user asks for 'data', 'readings', 'chart', 'live data', 'sensor data', "
    "'show me the data', or 'view data' for any asset. You MUST first get the asset detail to find sensor IDs, "
    "then call get_sensor_readings with a sensor_id. The result includes chart data with readings, baseline, "
    "and anomalies that render as an interactive chart.\n"
    "- Use query_tickets when user asks about 'my tickets' or 'assigned tickets'\n"
    "- Use query_anomalies to search for detected anomalies\n"
    "- When user says 'view T1 data' or 'show turbine data', ALWAYS call get_asset_detail first to find "
    "the sensor IDs, then call get_sensor_readings for the primary sensor.\n"
    "- Use create_ticket when user wants to create/raise/file a ticket. You can pass asset names directly "
    "(e.g. 'Turbine T-01') — the system resolves them to UUIDs. If the user hasn't specified a title or "
    "severity, ASK them in natural language before calling the tool. Include time ranges in the description "
    "if the user mentions specific times.\n"
)


class Agent:
    def _build_system_prompt(self) -> str:
        from datetime import datetime
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
        return SYSTEM_PROMPT + f"\nCURRENT DATE AND TIME: {now}. Always use this year ({datetime.utcnow().year}) when constructing date filters. NEVER use dates from 2023 or 2024.\n"

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))
        self.messages: List[Dict[str, Any]] = [
            {"role": "system", "content": self._build_system_prompt()}
        ]
        self.last_access = time.time()

    def cleanup(self):
        self.messages = [{"role": "system", "content": self._build_system_prompt()}]

    def run(self, user_input: str, context: Optional[Dict] = None) -> Dict[str, Any]:
        self.last_access = time.time()
        self.messages.append({"role": "user", "content": user_input})

        steps = []
        max_iterations = 5

        for iteration in range(max_iterations):
            try:
                response = self.client.chat.completions.create(
                    model=MODEL,
                    messages=self.messages,
                    tools=TOOLS,
                    tool_choice="auto",
                    max_tokens=4096,
                )
            except Exception as e:
                logger.error(f"OpenAI API error: {e}")
                return {"content": f"Error communicating with AI service: {str(e)}", "steps": steps}

            msg = response.choices[0].message

            # Add assistant message to history
            self.messages.append(msg)

            # If no tool calls, we're done
            if not msg.tool_calls:
                return {"content": msg.content or "", "steps": steps}

            # Execute tool calls
            for tc in msg.tool_calls:
                tool_name = tc.function.name
                try:
                    tool_args = json.loads(tc.function.arguments)
                except json.JSONDecodeError:
                    tool_args = {}

                logger.info(f"Executing tool: {tool_name} with args: {json.dumps(tool_args)[:200]}")
                steps.append({"type": "tool_call", "tool": tool_name, "args": tool_args})

                try:
                    result = execute_tool(tool_name, tool_args)
                    result_str = json.dumps(result, default=str)
                except Exception as e:
                    logger.error(f"Tool execution error: {e}")
                    result_str = json.dumps({"error": str(e)})

                steps.append({"type": "tool_result", "tool": tool_name, "result": json.loads(result_str)})

                self.messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result_str,
                })

        return {"content": "Maximum iterations reached. Please try a simpler query.", "steps": steps}

    def run_streaming(self, user_input: str, context: Optional[Dict] = None) -> Generator[Dict[str, Any], None, None]:
        self.last_access = time.time()
        self.messages.append({"role": "user", "content": user_input})

        max_iterations = 5
        accumulated_text = ""

        for iteration in range(max_iterations):
            try:
                stream = self.client.chat.completions.create(
                    model=MODEL,
                    messages=self.messages,
                    tools=TOOLS,
                    tool_choice="auto",
                    max_tokens=4096,
                    stream=True,
                )

                content_text = ""
                tool_calls_acc: Dict[int, Dict[str, Any]] = {}

                for chunk in stream:
                    delta = chunk.choices[0].delta if chunk.choices else None
                    if not delta:
                        continue

                    if delta.content:
                        content_text += delta.content
                        accumulated_text += delta.content
                        yield {"type": "text", "text": delta.content}

                    if delta.tool_calls:
                        for tc_delta in delta.tool_calls:
                            idx = tc_delta.index
                            if idx not in tool_calls_acc:
                                tool_calls_acc[idx] = {"id": "", "name": "", "arguments": ""}
                            if tc_delta.id:
                                tool_calls_acc[idx]["id"] = tc_delta.id
                            if tc_delta.function:
                                if tc_delta.function.name:
                                    tool_calls_acc[idx]["name"] = tc_delta.function.name
                                if tc_delta.function.arguments:
                                    tool_calls_acc[idx]["arguments"] += tc_delta.function.arguments

                # Build assistant message for history
                assistant_msg: Dict[str, Any] = {"role": "assistant", "content": content_text or None}
                if tool_calls_acc:
                    assistant_msg["tool_calls"] = [
                        {
                            "id": tc["id"],
                            "type": "function",
                            "function": {"name": tc["name"], "arguments": tc["arguments"]},
                        }
                        for tc in tool_calls_acc.values()
                    ]
                self.messages.append(assistant_msg)

                if not tool_calls_acc:
                    yield {"type": "done", "content": accumulated_text}
                    return

                for idx, tc in tool_calls_acc.items():
                    tool_name = tc["name"]
                    tool_call_id = tc["id"]

                    yield {"type": "tool_call", "tool_name": tool_name, "tool_call_id": tool_call_id, "args": {}}

                    try:
                        tool_args = json.loads(tc["arguments"])
                    except json.JSONDecodeError:
                        tool_args = {}

                    logger.info(f"Executing tool: {tool_name}")

                    try:
                        result = execute_tool(tool_name, tool_args)
                        result_str = json.dumps(result, default=str)
                    except Exception as e:
                        logger.error(f"Tool error: {e}")
                        result_str = json.dumps({"error": str(e)})

                    yield {"type": "tool_result", "tool_name": tool_name, "tool_call_id": tool_call_id, "result": json.loads(result_str)}

                    self.messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call_id,
                        "content": result_str,
                    })

            except Exception as e:
                logger.error(f"OpenAI API error: {e}", exc_info=True)
                yield {"type": "error", "content": f"AI service error: {str(e)}"}
                return

        yield {"type": "done", "content": accumulated_text}
