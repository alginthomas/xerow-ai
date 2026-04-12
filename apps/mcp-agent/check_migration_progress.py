"""
Quick script to check migration progress.
"""

import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ SUPABASE_URL and SUPABASE_KEY must be set")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Check progress
result = supabase.rpc('execute_sql', {
    'query': 'SELECT COUNT(*) as total, COUNT(embedding) as with_embeddings FROM employees;'
}).execute()

# Or use direct query
response = supabase.table('employees').select('id', count='exact').execute()
total = response.count or 0

response_with = supabase.table('employees').select('id', count='exact').not_.is_('embedding', 'null').execute()
with_embeddings = response_with.count or 0

print(f"\n📊 Migration Progress:")
print(f"{'='*50}")
print(f"Total employees: {total}")
print(f"With embeddings: {with_embeddings}")
print(f"Without embeddings: {total - with_embeddings}")
print(f"Progress: {(with_embeddings/total*100):.1f}%")
print(f"{'='*50}\n")
