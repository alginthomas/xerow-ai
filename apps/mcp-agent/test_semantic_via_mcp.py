"""
Test semantic search using Supabase MCP to call the database function directly.
"""

import os
import json
from dotenv import load_dotenv
from supabase_client import generate_embedding

load_dotenv()

def test_via_mcp():
    """Test semantic search via MCP execute_sql."""
    
    queries = [
        "experienced SAP developer",
        "Java consultant in Bengaluru", 
        "senior engineer with 5 years",
        "Power BI specialist"
    ]
    
    for query in queries:
        print(f"\n{'='*70}")
        print(f"🔍 Testing: '{query}'")
        print(f"{'='*70}\n")
        
        # Generate embedding
        embedding = generate_embedding(query)
        embedding_str = '[' + ','.join(map(str, embedding)) + ']'
        
        # SQL to test hybrid_search_employees
        sql = f"""
        SELECT 
            full_name,
            candidate_id,
            skill,
            overall_experience,
            current_location,
            expected_ctc,
            ROUND(similarity::numeric, 3) as similarity,
            keyword_match
        FROM hybrid_search_employees(
            '{query.replace("'", "''")}',
            '{embedding_str}'::vector,
            NULL, NULL, NULL, NULL, NULL, NULL, 5, 0.3
        )
        ORDER BY similarity DESC;
        """
        
        print(f"📊 Generated {len(embedding)}-dim embedding")
        print(f"🔍 Executing search...\n")
        
        # Note: This would need to be called via MCP tool
        # For now, print the SQL that can be run manually
        print("SQL Query (can be run in Supabase SQL Editor):")
        print("-" * 70)
        print(sql[:500] + "..." if len(sql) > 500 else sql)
        print("-" * 70)
        print("\n💡 To test, run this SQL in Supabase SQL Editor or use MCP tool\n")

if __name__ == "__main__":
    test_via_mcp()
