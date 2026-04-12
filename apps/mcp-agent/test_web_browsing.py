#!/usr/bin/env python3
"""
Test script for web browsing functionality
Tests the agent with web browsing mode enabled
"""

import sys
import json
from core import Agent

def main():
    # Initialize agent with a session ID
    agent = Agent(session_id="test-web-browsing")
    
    # Test query
    query = "iphone 17 prices"
    
    print(f"Testing web browsing mode with query: '{query}'")
    print("=" * 60)
    
    # Run with web browsing mode enabled
    context = {
        "web_browsing_mode": True
    }
    
    try:
        result = agent.run(query, context=context)
        
        print("\nResponse Content:")
        print("-" * 60)
        content = result.get("content", "No content")
        if not content or content.strip() == "":
            print("[Empty response - agent may still be processing or no results found]")
        elif isinstance(content, dict):
            # If content is a dict, it might be a tool call - show it
            print(json.dumps(content, indent=2))
        else:
            print(content)
        print("-" * 60)
        
        # Show full result structure for debugging
        print("\nFull Result Structure:")
        print("-" * 60)
        print(f"Keys: {list(result.keys())}")
        print(f"Content type: {type(content)}")
        print(f"Content length: {len(str(content)) if content else 0}")
        print("-" * 60)
        
        # Show tool steps
        steps = result.get("steps", [])
        if steps:
            print(f"\nTool Steps ({len(steps)}):")
            for i, step in enumerate(steps, 1):
                print(f"\n  Step {i}: {step.get('name', 'unknown')}")
                if step.get('args'):
                    print(f"    Args: {step.get('args')}")
                if step.get('result'):
                    result_data = step.get('result')
                    if isinstance(result_data, dict):
                        if 'error' in result_data:
                            print(f"    Error: {result_data.get('error')}")
                        elif 'results' in result_data:
                            results = result_data.get('results', [])
                            print(f"    Results: {len(results)} found")
                            if results:
                                for j, res in enumerate(results[:5], 1):  # Show first 5
                                    print(f"      {j}. {res.get('title', 'No title')[:60]}")
                                    print(f"         {res.get('url', 'No URL')[:60]}")
                                    print(f"         {res.get('snippet', '')[:80]}...")
                            else:
                                print(f"    Full result data: {json.dumps(result_data, indent=6)[:500]}")
                        else:
                            print(f"    Result: {str(result_data)[:100]}")
                    else:
                        print(f"    Result: {str(result_data)[:100]}")
        
        print("\n" + "=" * 60)
        
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Cleanup
        agent.cleanup()

if __name__ == "__main__":
    main()
