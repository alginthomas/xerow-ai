"""
Direct SQL test for semantic search using the database function.
"""

import os
import json
from dotenv import load_dotenv
from supabase_client import generate_embedding, supabase

load_dotenv()

def test_semantic_search_direct():
    """Test semantic search using direct SQL query."""
    
    # Test query
    query = "experienced SAP developer in Bengaluru"
    print(f"\n{'='*70}")
    print(f"🧪 Testing Semantic Search")
    print(f"{'='*70}")
    print(f"Query: '{query}'\n")
    
    # Generate embedding
    print("📊 Generating embedding...")
    embedding = generate_embedding(query)
    print(f"   ✓ Generated {len(embedding)}-dim embedding\n")
    
    # Format embedding for PostgreSQL
    embedding_str = '[' + ','.join(map(str, embedding)) + ']'
    
    # Test the hybrid_search_employees function
    print("🔍 Testing hybrid_search_employees function...")
    
    sql = f"""
    SELECT 
        full_name,
        candidate_id,
        skill,
        overall_experience,
        current_location,
        expected_ctc,
        similarity,
        keyword_match
    FROM hybrid_search_employees(
        '{query}',
        '{embedding_str}'::vector,
        NULL,  -- skill_filter
        NULL,  -- location_filter
        NULL,  -- stage_filter
        NULL,  -- status_filter
        NULL,  -- min_ctc
        NULL,  -- max_ctc
        10,    -- match_count
        0.3    -- min_similarity
    )
    LIMIT 10;
    """
    
    try:
        # Use Supabase to execute SQL
        response = supabase.rpc('execute_sql', {'query': sql}).execute()
        
        # If that doesn't work, try direct query
        if not response.data:
            print("   ⚠️  RPC not available, trying alternative method...")
            # We'll need to use a different approach
            print("   Note: Direct SQL execution may require Supabase admin access")
            return
        
        results = response.data
        print(f"   ✅ Found {len(results)} results\n")
        
        for i, emp in enumerate(results, 1):
            print(f"{i}. {emp.get('full_name', 'Unknown')} (Similarity: {emp.get('similarity', 0):.3f})")
            print(f"   Skill: {emp.get('skill', 'N/A')} | Exp: {emp.get('overall_experience', 'N/A')}")
            print(f"   Location: {emp.get('current_location', 'N/A')} | CTC: {emp.get('expected_ctc', 'N/A')}")
            print(f"   Keyword Match: {'✓' if emp.get('keyword_match') else '✗'}")
            print()
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
        print("\n   Trying alternative: Test with simple keyword search first...")
        
        # Fallback: Test that embeddings exist
        response = supabase.table('employees').select('full_name, skill, current_location').not_.is_('embedding', 'null').limit(5).execute()
        
        if response.data:
            print(f"\n   ✓ Verified: {len(response.data)} employees have embeddings")
            print("   Sample employees with embeddings:")
            for emp in response.data:
                print(f"      - {emp.get('full_name', 'Unknown')}")

if __name__ == "__main__":
    test_semantic_search_direct()
