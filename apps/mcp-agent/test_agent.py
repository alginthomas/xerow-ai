#!/usr/bin/env python3
"""Quick test script to verify the agent works"""

import requests
import json
from tools import TOOLS
from mcp_client import MCPClient

OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "llama3.1:8b"

# Test the full flow
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
    },
    {"role": "user", "content": "i want to buy cars"}
]

print("Sending request to Ollama...")
resp = requests.post(
    OLLAMA_URL,
    json={"model": MODEL, "messages": messages, "tools": TOOLS, "stream": False},
    timeout=30,
)

data = resp.json()
msg = data.get("message", {})
print(f"\nRaw response:\n{json.dumps(msg, indent=2)}\n")

if "tool_calls" in msg:
    print("Tool calls detected!")
    for call in msg["tool_calls"]:
        fn = call.get("function", {})
        name = fn.get("name")
        index = fn.get("index")
        args = fn.get("arguments", {})
        
        print(f"\nTool call:")
        print(f"  Name from response: '{name}'")
        print(f"  Index: {index}")
        print(f"  Raw args: {args}")
        
        # Apply our fix
        if not name and index is not None:
            name = TOOLS[index]["name"]
            print(f"  ✓ Fixed name using index: {name}")
        
        # Fix arguments
        if name == "search_products":
            if "query" not in args:
                query_candidates = [
                    args.get("category"),
                    args.get("subcategory"),
                    args.get("product_type"),
                ]
                query_parts = [str(q) for q in query_candidates if q]
                if query_parts:
                    args["query"] = " ".join(query_parts)
                    print(f"  ✓ Fixed query: {args['query']}")
            
            args = {k: v for k, v in args.items() if k in ["query", "max_price"]}
        
        print(f"  Final args: {args}")
        
        # Test calling MCP
        print(f"\n  Calling MCP server...")
        mcp = MCPClient()
        result = mcp.call(name, args)
        print(f"  Result: {json.dumps(result, indent=2)}")

else:
    print("No tool calls in response!")
    print(f"Content: {msg.get('content')}")
