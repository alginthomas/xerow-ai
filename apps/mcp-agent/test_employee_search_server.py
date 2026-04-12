"""
Test employee search function directly to verify it's working.
This simulates what the server does when search_employees tool is called.
"""

import os
import sys
import json
from dotenv import load_dotenv

# Add parent directory to path to import from server
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../server/src'))

from supabase_client import supabase, generate_embedding

load_dotenv()

def test_search_employees(query, skill=None, location=None, limit=5):
    """Test the searchEmployees function logic."""
    print(f"\n{'='*70}")
    print(f"🔍 Testing Employee Search")
    print(f"   Query: '{query}'")
    if skill:
        print(f"   Skill: {skill}")
    if location:
        print(f"   Location: {location}")
    print(f"{'='*70}\n")
    
    try:
        # Step 1: Generate embedding
        print("📊 Step 1: Generating embedding...")
        query_embedding = None
        if query.strip():
            try:
                query_embedding = generate_embedding(query)
                print(f"   ✓ Embedding generated ({len(query_embedding)} dimensions)")
            except Exception as e:
                print(f"   ⚠️  Failed to generate embedding: {e}")
                print("   Continuing with keyword search only...")
        
        # Step 2: Build SQL query (matching server logic)
        print("\n📊 Step 2: Building SQL query...")
        sql = 'SELECT * FROM hybrid_search_employees('
        sql_params = []
        param_count = 1
        
        # search_query
        sql += f'${param_count}, '
        sql_params.append(query or '')
        param_count += 1
        
        # query_embedding
        if query_embedding:
            sql += f'${param_count}::vector, '
            sql_params.append(f'[{",".join(map(str, query_embedding))}]')
        else:
            sql += 'NULL::vector, '
        param_count += 1
        
        # skill_filter
        sql += f'${param_count}, '
        sql_params.append(skill)
        param_count += 1
        
        # location_filter
        sql += f'${param_count}, '
        sql_params.append(location)
        param_count += 1
        
        # stage_filter
        sql += f'${param_count}, '
        sql_params.append(None)
        param_count += 1
        
        # status_filter
        sql += f'${param_count}, '
        sql_params.append(None)
        param_count += 1
        
        # min_ctc
        sql += f'${param_count}, '
        sql_params.append(None)
        param_count += 1
        
        # max_ctc
        sql += f'${param_count}, '
        sql_params.append(None)
        param_count += 1
        
        # match_count
        sql += f'${param_count}, '
        sql_params.append(limit)
        param_count += 1
        
        # min_similarity
        sql += f'${param_count})'
        sql_params.append(0.3)
        
        print(f"   SQL: {sql[:100]}...")
        print(f"   Parameters: {len(sql_params)} params")
        
        # Step 3: Execute query
        print("\n📊 Step 3: Executing query...")
        try:
            # Try RPC call first
            response = supabase.rpc('hybrid_search_employees', {
                'search_query': query or '',
                'query_embedding': query_embedding,
                'skill_filter': skill,
                'location_filter': location,
                'stage_filter': None,
                'status_filter': None,
                'min_ctc': None,
                'max_ctc': None,
                'match_count': limit,
                'min_similarity': 0.3
            }).execute()
            
            employees = response.data if hasattr(response, 'data') else []
            print(f"   ✓ RPC call successful")
            
        except Exception as rpc_error:
            print(f"   ⚠️  RPC call failed: {rpc_error}")
            print("   Trying direct SQL query...")
            
            # Fallback: Direct query
            query_builder = supabase.table('employees').select('*')
            
            if query:
                query_builder = query_builder.or_(f"full_name.ilike.%{query}%,skill.ilike.%{query}%,current_location.ilike.%{query}%")
            
            if skill:
                query_builder = query_builder.ilike('skill', f'%{skill}%')
            
            if location:
                query_builder = query_builder.or_(f"current_location.ilike.%{location}%,preferred_location.ilike.%{location}%")
            
            response = query_builder.limit(limit).execute()
            employees = response.data if hasattr(response, 'data') else []
            print(f"   ✓ Direct query successful")
        
        # Step 4: Display results
        print(f"\n📊 Step 4: Results")
        if not employees:
            print("   ❌ No employees found")
            return []
        
        print(f"   ✅ Found {len(employees)} employees:\n")
        for i, emp in enumerate(employees[:5], 1):
            print(f"   {i}. {emp.get('full_name', 'Unknown')} ({emp.get('candidate_id', 'N/A')})")
            print(f"      Skill: {emp.get('skill', 'N/A')}")
            print(f"      Experience: {emp.get('overall_experience', 'N/A')}")
            print(f"      Location: {emp.get('current_location') or emp.get('preferred_location', 'N/A')}")
            print()
        
        return employees
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return []

def main():
    """Run tests."""
    print("\n" + "="*70)
    print("🧪 Employee Search Server Function Test")
    print("="*70)
    
    test_cases = [
        {'query': 'Java developer', 'description': 'Basic developer search'},
        {'query': 'SAP consultant', 'description': 'SAP consultant search'},
        {'query': 'developer', 'description': 'Generic developer search'},
    ]
    
    for i, test in enumerate(test_cases, 1):
        print(f"\n📝 Test {i}/{len(test_cases)}: {test['description']}")
        employees = test_search_employees(test['query'], limit=5)
        
        if not employees:
            print(f"   ⚠️  No results for query: '{test['query']}'")
    
    print("\n" + "="*70)
    print("✅ Testing completed!")
    print("="*70 + "\n")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
