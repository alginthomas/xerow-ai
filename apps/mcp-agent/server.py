"""
Xerow AI - FastAPI Server
SSE streaming endpoint for Claude-powered industrial monitoring assistant.
"""

import json
import logging
import os
import time
import uuid
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from core import Agent

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Session store ────────────────────────────────────────────────

sessions: dict[str, Agent] = {}
SESSION_TTL = 3600  # 1 hour
CLEANUP_INTERVAL = 300  # 5 minutes


def cleanup_expired_sessions():
    current = time.time()
    expired = [
        sid for sid, agent in sessions.items()
        if current - agent.last_access > SESSION_TTL
    ]
    for sid in expired:
        agent = sessions.pop(sid)
        try:
            agent.cleanup()
        except Exception as e:
            logger.error(f"Cleanup error for {sid}: {e}")
        logger.info(f"Expired session: {sid}")


async def background_cleanup():
    while True:
        await asyncio.sleep(CLEANUP_INTERVAL)
        try:
            cleanup_expired_sessions()
        except Exception as e:
            logger.error(f"Cleanup task error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(background_cleanup())
    logger.info("Started session cleanup task")
    yield
    task.cancel()
    for agent in sessions.values():
        try:
            agent.cleanup()
        except Exception:
            pass
    sessions.clear()


# ── FastAPI app ──────────────────────────────────────────────────

app = FastAPI(title="Xerow AI Agent API", lifespan=lifespan)

is_dev = os.getenv("ENV", "development") == "development"
if is_dev:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# ── Models ───────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    context: dict | None = None


class ChatResponse(BaseModel):
    content: str
    session_id: str
    steps: list = []


# ── Routes ───────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "Xerow AI Agent", "model": "claude-sonnet"}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    session_id = req.session_id or str(uuid.uuid4())

    if session_id not in sessions:
        sessions[session_id] = Agent(session_id)
        logger.info(f"New session: {session_id}")

    agent = sessions[session_id]

    try:
        result = agent.run(req.message, context=req.context)
        return ChatResponse(
            content=result.get("content", ""),
            session_id=session_id,
            steps=result.get("steps", []),
        )
    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest):
    """SSE streaming endpoint for real-time Claude responses with tool calling."""
    session_id = req.session_id or str(uuid.uuid4())

    if session_id not in sessions:
        sessions[session_id] = Agent(session_id)
        logger.info(f"New streaming session: {session_id}")

    agent = sessions[session_id]

    async def generate():
        # Send session ID first
        yield f"event: session\ndata: {json.dumps({'session_id': session_id})}\n\n"

        try:
            for event in agent.run_streaming(req.message, context=req.context):
                event_type = event.get("type", "")

                if event_type == "text":
                    yield f"event: text\ndata: {json.dumps({'text': event['text']})}\n\n"

                elif event_type == "tool_call":
                    yield f"event: tool\ndata: {json.dumps({'type': 'tool-call', 'toolCallId': event.get('tool_call_id', ''), 'toolName': event.get('tool_name', ''), 'args': event.get('args', {})})}\n\n"

                elif event_type == "tool_result":
                    yield f"event: tool\ndata: {json.dumps({'type': 'tool-result', 'toolCallId': event.get('tool_call_id', ''), 'toolName': event.get('tool_name', ''), 'result': event.get('result', {})})}\n\n"

                elif event_type == "done":
                    yield f"event: done\ndata: {json.dumps({'content': event.get('content', ''), 'session_id': session_id})}\n\n"

                elif event_type == "error":
                    yield f"event: error\ndata: {json.dumps({'error': event.get('content', 'Unknown error')})}\n\n"

        except Exception as e:
            logger.error(f"Stream error: {e}", exc_info=True)
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# ── Main ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
