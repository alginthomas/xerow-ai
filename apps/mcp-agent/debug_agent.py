#!/usr/bin/env python3
"""
Minimal test to debug the agent issue.
This simulates exactly what agent.py does but with more visibility.
"""

import requests
import json
import logging
from tools import TOOLS
from mcp_client import MCPClient

logging.basicConfig(level=logging.DEBUG, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "llama3.1:8b"

messages = [
    {
        "role": "system",
        "content": (
            "You are a shopping assistant that helps users find products.\n\n"
            "IMPORTANT: You have access to these tools:\n"
            "1. search_products(query, max_price) - Search for products. "
            "The 'query' should be the product type (e.g., 'running shoes', 'laptop'). "
            "The 'max_price' is optional and should be a number.\n"
            "2. compare_products(product_ids) - Compare products by their IDs.\n\n"
            "When a user asks for products, ALWAYS use the search_products tool.\n"
            "Use ONLY the exact parameter names: 'query' and 'max_price'.\n"
            "Do not invent products or prices - only use tool results.\n\n"
            "Example: If user says 'I need running shoes under 4500', call:\n"
            "search_products with {\"query\": \"running shoes\", \"max_price\": 4500}"
        )
    }
]

def chat():
    logger.info("Sending request to Ollama...")
    resp = requests.post(
        OLLAMA_URL,
        json={"model": MODEL, "messages": messages, "tools": TOOLS},
        timeout=30,
    )
    data = resp.json()
    if "message" in data:
        return data["message"]
    return data

# Simulate user input
user_query = "i want cars"
logger.info(f"User query: {user_query}")
messages.append({"role": "user", "content": user_query})

# First call
msg = chat()
logger.debug(f"First response: {json.dumps(msg, indent=2)}")

# Check for tool calls
if isinstance(msg, dict) and "tool_calls" in msg:
    logger.info("Tool calls detected!")
    
    for call in msg["tool_calls"]:
        fn = call.get("function", {})
        name = fn.get("name")
        index = fn.get("index")
        args = fn.get("arguments", {})
        
        logger.debug(f"Raw tool call: name='{name}', index={index}, args={args}")
        
        # Fix name
        if not name and index is not None:
            name = TOOLS[index]["name"]
            logger.info(f"Fixed name using index: {name}")
        
        # Fix args
        if name == "search_products" and "query" not in args:
            query_candidates = [args.get("category"), args.get("subcategory")]
            query_parts = [str(q) for q in query_candidates if q]
            if query_parts:
                args["query"] = " ".join(query_parts)
                logger.info(f"Fixed query: {args['query']}")
            args = {k: v for k, v in args.items() if k in ["query", "max_price"]}
        
        logger.info(f"Calling tool: {name} with args: {args}")
        
        # Call MCP
        mcp = MCPClient()
        result = mcp.call(name, args)
        logger.info(f"Tool result: {json.dumps(result, indent=2)}")
        
        # Add tool result to messages
        messages.append({
            "role": "tool",
            "name": name,
            "content": json.dumps(result),
        })
    
    # Second call to get final response
    logger.info("Calling LLM again with tool results...")
    msg = chat()
    logger.debug(f"Second response: {json.dumps(msg, indent=2)}")

# Print final content
content = msg.get("content") if isinstance(msg, dict) else str(msg)
logger.info(f"Final content: {content}")

if content and content.strip():
    print(f"\n✅ SUCCESS! Agent response:\n{content}\n")
else:
    print(f"\n❌ PROBLEM! Empty response from agent")
    print(f"Full message: {json.dumps(msg, indent=2)}\n")
    print("This means:")
    print("1. Tool calling worked ✅")
    print("2. Tool execution worked ✅")
    print("3. LLM is not generating text after tool results ❌")
    print("\nPossible fixes:")
    print("- Restart Ollama: ollama serve")
    print("- Try a different model: ollama pull mistral")
    print("- Check Ollama logs for errors")
