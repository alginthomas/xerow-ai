"""
CLI test script for employee semantic search.
Tests the hybrid_search_employees function with various queries.
"""

import os
import sys
import json
from dotenv import load_dotenv
from supabase_client import supabase, generate_embedding

load_dotenv()

def format_employee(emp):
    """Format employee for display."""
    return {
        'name': emp.get('full_name', 'Unknown'),
        'candidate_id': emp.get('candidate_id', 'N/A'),
        'skill': emp.get('skill', 'N/A'),
        'experience': emp.get('overall_experience', 'N/A'),
        'location': emp.get('current_location') or emp.get('preferred_location', 'N/A'),
        'ctc': emp.get('expected_ctc') or emp.get('current_ctc', 'N/A'),
        'stage': emp.get('stage', 'N/A'),
        'status': emp.get('status', 'N/A'),
        'similarity': f"{emp.get('similarity', 0):.3f}" if emp.get('similarity') else 'N/A',
        'keyword_match': '✓' if emp.get('keyword_match') else '✗'
    }

def test_search(query, skill=None, location=None, limit=5):
    """Test employee search with a query."""
    print(f"\n{'='*70}")
    print(f"🔍 Search Query: '{query}'")
    if skill:
        print(f"   Skill Filter: {skill}")
    if location:
        print(f"   Location Filter: {location}")
    print(f"{'='*70}\n")
    
    try:
        # Generate embedding for the query
        print("📊 Generating query embedding...")
        query_embedding = generate_embedding(query)
        print(f"   ✓ Embedding generated ({len(query_embedding)} dimensions)\n")
        
        # Build SQL query to call hybrid_search_employees
        # Note: We'll use Supabase RPC if available, otherwise direct SQL
        try:
            # Try using RPC call
            response = supabase.rpc('hybrid_search_employees', {
                'search_query': query,
                'query_embedding': query_embedding,
                'skill_filter': skill,
                'location_filter': location,
                'stage_filter': None,
                'status_filter': None,
                'min_ctc': None,
                'max_ctc': None,
                'match_count': limit,
                'min_similarity': 0.3  # Lower threshold for testing
            }).execute()
            
            results = response.data if hasattr(response, 'data') else []
            
        except Exception as rpc_error:
            print(f"   ⚠️  RPC call failed: {rpc_error}")
            print("   Trying direct SQL query...\n")
            
            # Fallback: Use direct query (simpler keyword search)
            query_builder = supabase.table('employees').select('*')
            
            if query:
                # Simple keyword search as fallback
                query_builder = query_builder.or_(f"full_name.ilike.%{query}%,skill.ilike.%{query}%,current_location.ilike.%{query}%")
            
            if skill:
                query_builder = query_builder.ilike('skill', f'%{skill}%')
            
            if location:
                query_builder = query_builder.or_(f"current_location.ilike.%{location}%,preferred_location.ilike.%{location}%")
            
            response = query_builder.limit(limit).execute()
            results = response.data if hasattr(response, 'data') else []
        
        if not results:
            print("❌ No results found\n")
            return
        
        print(f"✅ Found {len(results)} results:\n")
        
        for i, emp in enumerate(results, 1):
            formatted = format_employee(emp)
            print(f"{i}. {formatted['name']} ({formatted['candidate_id']})")
            print(f"   Skill: {formatted['skill']} | Exp: {formatted['experience']}")
            print(f"   Location: {formatted['location']} | CTC: {formatted['ctc']}")
            print(f"   Stage: {formatted['stage']} | Status: {formatted['status']}")
            if formatted['similarity'] != 'N/A':
                print(f"   Similarity: {formatted['similarity']} | Keyword Match: {formatted['keyword_match']}")
            print()
        
        return results
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return None

def main():
    """Run test searches."""
    print("\n" + "="*70)
    print("🧪 Employee Semantic Search CLI Test")
    print("="*70)
    
    # Test queries
    test_cases = [
        {
            'query': 'SAP developer',
            'description': 'Basic skill search'
        },
        {
            'query': 'experienced Java consultant',
            'description': 'Natural language query with experience'
        },
        {
            'query': 'Bengaluru',
            'description': 'Location-based search'
        },
        {
            'query': 'senior engineer with 5 years experience',
            'description': 'Complex natural language query'
        },
        {
            'query': 'Power BI',
            'skill': 'Power BI',
            'description': 'Query with skill filter'
        },
        {
            'query': 'developer',
            'location': 'Pune',
            'description': 'Query with location filter'
        }
    ]
    
    for i, test in enumerate(test_cases, 1):
        print(f"\n📝 Test {i}/{len(test_cases)}: {test['description']}")
        test_search(
            query=test['query'],
            skill=test.get('skill'),
            location=test.get('location'),
            limit=5
        )
    
    print("\n" + "="*70)
    print("✅ All tests completed!")
    print("="*70 + "\n")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
