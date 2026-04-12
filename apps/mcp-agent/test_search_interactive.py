"""
Interactive CLI test for employee semantic search.
Allows testing different queries interactively.
"""

import os
import sys
from dotenv import load_dotenv
from supabase_client import supabase, generate_embedding

load_dotenv()

def search_employees(query, skill=None, location=None, limit=10):
    """Search employees using hybrid search."""
    print(f"\n🔍 Searching: '{query}'")
    if skill:
        print(f"   Skill: {skill}")
    if location:
        print(f"   Location: {location}")
    print()
    
    try:
        # Generate embedding
        query_embedding = generate_embedding(query)
        
        # Format embedding for PostgreSQL vector
        embedding_str = '[' + ','.join(map(str, query_embedding)) + ']'
        
        # Build SQL query
        sql = f"""
        SELECT 
            full_name,
            candidate_id,
            skill,
            overall_experience,
            current_location,
            preferred_location,
            expected_ctc,
            current_ctc,
            stage,
            status,
            ROUND((1 - (embedding <=> '{embedding_str}'::vector))::numeric, 3) as similarity,
            (
                full_name ILIKE '%{query}%' OR
                COALESCE(skill, '') ILIKE '%{query}%' OR
                COALESCE(current_location, '') ILIKE '%{query}%' OR
                COALESCE(preferred_location, '') ILIKE '%{query}%'
            ) as keyword_match
        FROM employees
        WHERE 
            embedding IS NOT NULL
            AND (
                full_name ILIKE '%{query}%' OR
                COALESCE(skill, '') ILIKE '%{query}%' OR
                COALESCE(current_location, '') ILIKE '%{query}%' OR
                COALESCE(preferred_location, '') ILIKE '%{query}%' OR
                (1 - (embedding <=> '{embedding_str}'::vector)) >= 0.3
            )
        """
        
        if skill:
            sql += f" AND COALESCE(skill, '') ILIKE '%{skill}%'"
        
        if location:
            sql += f" AND (current_location ILIKE '%{location}%' OR preferred_location ILIKE '%{location}%')"
        
        sql += f"""
        ORDER BY 
            keyword_match DESC,
            embedding <=> '{embedding_str}'::vector
        LIMIT {limit};
        """
        
        # Use Supabase table query with keyword search
        # Note: For full semantic search, use the hybrid_search_employees function via SQL
        query_builder = supabase.table('employees').select('*')
        
        # Build search conditions
        conditions = []
        if query:
            # Search across multiple fields
            conditions.append(f"full_name.ilike.%{query}%")
            conditions.append(f"skill.ilike.%{query}%")
            conditions.append(f"current_location.ilike.%{query}%")
            conditions.append(f"preferred_location.ilike.%{query}%")
            conditions.append(f"current_company.ilike.%{query}%")
            query_builder = query_builder.or_(','.join(conditions))
        
        if skill:
            query_builder = query_builder.ilike('skill', f'%{skill}%')
        
        if location:
            query_builder = query_builder.or_(f"current_location.ilike.%{location}%,preferred_location.ilike.%{location}%")
        
        # Only get employees with embeddings
        query_builder = query_builder.not_.is_('embedding', 'null')
        
        response = query_builder.limit(limit).execute()
        results = response.data if hasattr(response, 'data') else []
        
        if not results:
            print("❌ No results found\n")
            return []
        
        print(f"✅ Found {len(results)} results:\n")
        
        for i, emp in enumerate(results, 1):
            print(f"{i}. {emp.get('full_name', 'Unknown')} ({emp.get('candidate_id', 'N/A')})")
            if emp.get('skill'):
                print(f"   Skill: {emp.get('skill')}")
            if emp.get('overall_experience'):
                print(f"   Experience: {emp.get('overall_experience')} years")
            if emp.get('current_location') or emp.get('preferred_location'):
                loc = emp.get('current_location') or emp.get('preferred_location', 'N/A')
                print(f"   Location: {loc}")
            if emp.get('expected_ctc') or emp.get('current_ctc'):
                ctc = emp.get('expected_ctc') or emp.get('current_ctc', 'N/A')
                print(f"   CTC: {ctc}")
            if emp.get('stage'):
                print(f"   Stage: {emp.get('stage')}")
            print()
        
        return results
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return []

def interactive_mode():
    """Run in interactive mode."""
    print("\n" + "="*70)
    print("🧪 Employee Semantic Search - Interactive CLI")
    print("="*70)
    print("\nEnter search queries (or 'quit' to exit)")
    print("Examples:")
    print("  - SAP developer")
    print("  - experienced Java consultant")
    print("  - Bengaluru")
    print("  - Power BI consultant in Pune")
    print()
    
    while True:
        try:
            query = input("🔍 Search: ").strip()
            
            if not query or query.lower() in ['quit', 'exit', 'q']:
                print("\n👋 Goodbye!\n")
                break
            
            # Parse optional filters (simple format: "query | skill:Java | location:Bengaluru")
            parts = query.split('|')
            main_query = parts[0].strip()
            skill = None
            location = None
            
            for part in parts[1:]:
                part = part.strip()
                if part.startswith('skill:'):
                    skill = part.replace('skill:', '').strip()
                elif part.startswith('location:'):
                    location = part.replace('location:', '').strip()
            
            search_employees(main_query, skill=skill, location=location, limit=10)
            
        except KeyboardInterrupt:
            print("\n\n👋 Goodbye!\n")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}\n")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Non-interactive mode with command line args
        query = sys.argv[1]
        skill = sys.argv[2] if len(sys.argv) > 2 else None
        location = sys.argv[3] if len(sys.argv) > 3 else None
        search_employees(query, skill=skill, location=location)
    else:
        # Interactive mode
        interactive_mode()
