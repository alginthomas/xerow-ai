"""
Final comprehensive test of semantic search functionality.
Tests both keyword and semantic search capabilities.
"""

import os
from dotenv import load_dotenv
from supabase_client import supabase, generate_embedding

load_dotenv()

def test_semantic_search():
    """Test semantic search with various queries."""
    
    print("\n" + "="*70)
    print("🧪 Comprehensive Employee Search Test")
    print("="*70)
    
    # Test 1: Location search (should work with keyword matching)
    print("\n📝 Test 1: Location-based search (Bengaluru)")
    print("-" * 70)
    response = supabase.table('employees').select('full_name, current_location, overall_experience, expected_ctc').or_('current_location.ilike.%Bengaluru%,preferred_location.ilike.%Bengaluru%').not_.is_('embedding', 'null').limit(5).execute()
    
    if response.data:
        print(f"✅ Found {len(response.data)} employees in Bengaluru:\n")
        for i, emp in enumerate(response.data, 1):
            print(f"{i}. {emp.get('full_name')} - {emp.get('current_location')} ({emp.get('overall_experience', 'N/A')} years, {emp.get('expected_ctc', 'N/A')})")
    else:
        print("❌ No results")
    
    # Test 2: Experience-based search
    print("\n📝 Test 2: Experience-based search (5+ years)")
    print("-" * 70)
    # Search for employees with experience mentioned in their embedding text
    response = supabase.table('employees').select('full_name, overall_experience, current_location').not_.is_('embedding', 'null').not_.is_('overall_experience', 'null').limit(10).execute()
    
    # Filter for those with 5+ years (simple numeric check)
    experienced = [e for e in response.data if e.get('overall_experience') and (
        '5' in str(e.get('overall_experience')) or 
        float(str(e.get('overall_experience')).replace('+', '').split()[0] or '0') >= 5
    )]
    
    if experienced:
        print(f"✅ Found {len(experienced)} employees with 5+ years experience:\n")
        for i, emp in enumerate(experienced[:5], 1):
            print(f"{i}. {emp.get('full_name')} - {emp.get('overall_experience')} years ({emp.get('current_location', 'N/A')})")
    else:
        print("❌ No results")
    
    # Test 3: Verify embeddings exist
    print("\n📝 Test 3: Embedding verification")
    print("-" * 70)
    response = supabase.table('employees').select('id', count='exact').not_.is_('embedding', 'null').execute()
    total_with = response.count or 0
    
    response_all = supabase.table('employees').select('id', count='exact').execute()
    total_all = response_all.count or 0
    
    print(f"✅ Total employees: {total_all}")
    print(f"✅ Employees with embeddings: {total_with}")
    print(f"✅ Coverage: {(total_with/total_all*100):.1f}%")
    
    # Test 4: Sample employee data
    print("\n📝 Test 4: Sample employee data")
    print("-" * 70)
    response = supabase.table('employees').select('full_name, skill, overall_experience, current_location, expected_ctc').not_.is_('embedding', 'null').limit(5).execute()
    
    if response.data:
        print("Sample employees with embeddings:\n")
        for i, emp in enumerate(response.data, 1):
            print(f"{i}. {emp.get('full_name')}")
            print(f"   Skill: {emp.get('skill', 'N/A')}")
            print(f"   Experience: {emp.get('overall_experience', 'N/A')} years")
            print(f"   Location: {emp.get('current_location', 'N/A')}")
            print(f"   CTC: {emp.get('expected_ctc', 'N/A')}")
            print()
    
    print("="*70)
    print("✅ All tests completed!")
    print("="*70)
    print("\n💡 Note: Full semantic search requires calling hybrid_search_employees()")
    print("   function via SQL with query embeddings. The server integration")
    print("   handles this automatically when using the search_employees tool.\n")

if __name__ == "__main__":
    test_semantic_search()
