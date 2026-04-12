"""
Add embeddings to existing employees in Supabase.
Reads existing employee data and generates vector embeddings.
"""
import os
from dotenv import load_dotenv
from supabase import create_client
from sentence_transformers import SentenceTransformer
from tqdm import tqdm

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in .env file")

# Initialize Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Initialize embedding model
print("Loading embedding model...")
model = SentenceTransformer('all-MiniLM-L6-v2')


def create_employee_text(employee):
    """Create text representation for embedding."""
    parts = []
    
    if employee.get('full_name'):
        parts.append(f"Name: {employee['full_name']}")
    
    if employee.get('skill'):
        parts.append(f"Skills: {employee['skill']}")
    
    if employee.get('overall_experience'):
        parts.append(f"Overall Experience: {employee['overall_experience']}")
    
    if employee.get('relevant_experience'):
        parts.append(f"Relevant Experience: {employee['relevant_experience']}")
    
    if employee.get('current_location'):
        parts.append(f"Current Location: {employee['current_location']}")
    
    if employee.get('preferred_location'):
        parts.append(f"Preferred Location: {employee['preferred_location']}")
    
    if employee.get('current_company'):
        parts.append(f"Current Company: {employee['current_company']}")
    
    if employee.get('highest_education'):
        parts.append(f"Education: {employee['highest_education']}")

    if employee.get('requirement_subject'):
        parts.append(f"Requirement: {employee['requirement_subject']}")
    
    return ". ".join(parts) if parts else "No information available"


def add_embeddings_to_existing(batch_size=50):
    """
    Fetch existing employees and add embeddings.
    """
    print("Fetching employees from Supabase...")
    
    # Fetch ALL employees without embeddings using pagination
    all_employees = []
    page_size = 1000
    offset = 0
    
    while True:
        # Fetch ALL employees (even if they already have embeddings) to update them
        response = supabase.table('employees').select('*').range(offset, offset + page_size - 1).execute()
        employees = response.data
        
        if not employees:
            break
        
        all_employees.extend(employees)
        offset += page_size
        print(f"  Fetched {len(all_employees)} employees so far...")
        
        # Break if we got less than page_size (means we're at the end)
        if len(employees) < page_size:
            break
    
    print(f"\nFound {len(all_employees)} employees without embeddings")
    
    if not all_employees:
        print("All employees already have embeddings!")
        return
    
    updated_count = 0
    failed_count = 0
    
    # Process in batches
    for i in tqdm(range(0, len(all_employees), batch_size), desc="Adding embeddings"):
        batch = all_employees[i:i + batch_size]
        
        for emp in batch:
            try:
                # Create text for embedding
                emp_text = create_employee_text(emp)
                
                # Generate embedding
                embedding = model.encode(emp_text).tolist()
                
                # Update employee with embedding
                supabase.table('employees').update({
                    'embedding': embedding
                }).eq('id', emp['id']).execute()
                
                updated_count += 1
                
            except Exception as e:
                print(f"\nError updating employee {emp.get('candidate_id', 'unknown')}: {e}")
                failed_count += 1
                continue
    
    print(f"\n✅ Complete!")
    print(f"   Updated: {updated_count}")
    print(f"   Failed: {failed_count}")
    print(f"   Total: {len(all_employees)}")


if __name__ == "__main__":
    add_embeddings_to_existing()
