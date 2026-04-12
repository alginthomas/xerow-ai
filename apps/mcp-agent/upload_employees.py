"""
Upload employee data from CSV to Supabase with embeddings.
Generates vector embeddings for semantic search on employee profiles.
"""
import pandas as pd
import os
from dotenv import load_dotenv
from supabase import create_client
from sentence_transformers import SentenceTransformer
from tqdm import tqdm
import numpy as np

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in .env file")

# Initialize Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Initialize embedding model (same as product search)
print("Loading embedding model...")
model = SentenceTransformer('all-MiniLM-L6-v2')  # 384-dimensional embeddings

# Column mapping: CSV column name -> Database column name
COLUMN_MAP = {
    'Candidate ID': 'candidate_id',
    'Index No': 'index_no',
    'Candidate Full Name': 'full_name',
    'Email-ID': 'email',
    'Phone Number': 'phone_number',
    'Alternate/Emergency Contact Number': 'alternate_phone',
    'Skill\u200b': 'skill',  # Has special character
    'Overall Experience': 'overall_experience',
    'Relevant Experience': 'relevant_experience',
    'Current Location': 'current_location',
    'Preferred Location': 'preferred_location',
    'Current Company\u200b': 'current_company',
    'Current CTC\u200b': 'current_ctc',
    'Expected CTC': 'expected_ctc',
    'Stage': 'stage',
    'Status': 'status',
    'Date Of Final Select': 'date_of_final_select',
    'DOJ': 'doj',
    'Resume/CV/Profile (Latest/Updated) (Attach Below)': 'resume_url',
    'Recruiter Name': 'recruiter_name',
    'Recruiter Name2': 'recruiter_name2',
    'Recruiter Comment': 'recruiter_comment',
    'Email': 'recruiter_email',
    'Account Manager\u200b': 'account_manager',
    'Account Manager Email': 'account_manager_email',
    'Team Lead': 'team_lead',
    'Client': 'client',
    'Client SPOC': 'client_spoc',
    'REQUIREMENT ID:\u200b': 'requirement_id',
    'Requirement Against which this profile is being submitted (Paste Subject Line)': 'requirement_subject',
    'Sourcing channel': 'sourcing_channel',
    'Sourcer Name ( Only Applies to Vendor )': 'sourcer_name',
    'Earliest Available timings for Interview': 'earliest_available_timings',
    'Notice Period/Last Working Day': 'notice_period',
    'Mode Of Hire': 'mode_of_hire',
    'Payroll': 'payroll',
    'Monthly Bill Rate': 'monthly_bill_rate',
    '(If Vendor) Vendor Bill Rate': 'vendor_bill_rate',
    'Can this candidate be considered for the Virtual Bench List?': 'can_consider_virtual_bench',
    'Offered': 'offered',
    'Onboarded2': 'onboarded',
    'Highest Education with Year (EG: BTECH - 2007)': 'highest_education',
    'Higher Education Completed in Year': 'higher_education_year',
    'DOB': 'dob',
    'MailTO': 'mail_to',
    'MailCC': 'mail_cc',
    'EmailStage': 'email_stage',
    'Mail Confirmation': 'mail_confirmation',
    'Start time': 'start_time',
    'Completion time': 'completion_time',
    'Sourced Date - DD/MM/YY.\u200b(Date during which candidate was sourced).Please note that the Submission date is automatically recorded in the database upon submitting this form.': 'sourced_date'
}


def get_value(row, csv_col):
    """Get value from row using CSV column name."""
    value = row.get(csv_col)
    return value if pd.notna(value) else None


def create_employee_text(row):
    """
    Create a text representation of employee for embedding.
    Combines the most semantically meaningful fields.
    """
    parts = []
    
    # Name
    name = get_value(row, 'Candidate Full Name')
    if name:
        parts.append(f"Name: {name}")
    
    # Skills (most important!)
    skill = get_value(row, 'Skill\u200b')
    if skill:
        parts.append(f"Skills: {skill}")
    
    # Experience
    overall_exp = get_value(row, 'Overall Experience')
    if overall_exp:
        parts.append(f"Overall Experience: {overall_exp}")
    
    relevant_exp = get_value(row, 'Relevant Experience')
    if relevant_exp:
        parts.append(f"Relevant Experience: {relevant_exp}")
    
    # Location
    current_loc = get_value(row, 'Current Location')
    if current_loc:
        parts.append(f"Current Location: {current_loc}")
    
    preferred_loc = get_value(row, 'Preferred Location')
    if preferred_loc:
        parts.append(f"Preferred Location: {preferred_loc}")
    
    # Current company
    company = get_value(row, 'Current Company\u200b')
    if company:
        parts.append(f"Current Company: {company}")
    
    # Education
    education = get_value(row, 'Highest Education with Year (EG: BTECH - 2007)')
    if education:
        parts.append(f"Education: {education}")

    # Requirement
    req_subject = get_value(row, 'Requirement Against which this profile is being submitted (Paste Subject Line)')
    if req_subject:
        parts.append(f"Requirement: {req_subject}")
    
    return ". ".join(parts) if parts else "No information available"


def parse_ctc(ctc_str):
    """Parse CTC string to numeric value (in lakhs)."""
    if not ctc_str or pd.isna(ctc_str):
        return None
    
    try:
        # Remove common text and extract number
        ctc_str = str(ctc_str).lower().replace('lpa', '').replace('lakh', '').replace('₹', '').strip()
        return float(ctc_str)
    except:
        return None


def parse_date(date_str):
    """Parse date string to YYYY-MM-DD format, handling multiple formats."""
    if not date_str or pd.isna(date_str):
        return None
    
    try:
        from dateutil import parser
        # Try to parse with dateutil (handles most formats)
        parsed = parser.parse(str(date_str), dayfirst=True)
        return parsed.strftime('%Y-%m-%d')
    except:
        # If parsing fails, return None instead of crashing
        return None


def parse_timestamp(ts_str):
    """Parse timestamp string to ISO format."""
    if not ts_str or pd.isna(ts_str):
        return None
    
    try:
        from dateutil import parser
        # Try to parse timestamp
        parsed = parser.parse(str(ts_str))
        return parsed.isoformat()
    except:
        return None


def upload_employees(csv_path: str, batch_size: int = 10):
    """
    Upload employees from CSV to Supabase with embeddings.
    
    Args:
        csv_path: Path to CSV file
        batch_size: Number of employees to upload per batch
    """
    print(f"Reading CSV from: {csv_path}")
    
    # Try different encodings
    encodings = ['utf-8', 'latin-1', 'iso-8859-1', 'cp1252']
    df = None
    
    for encoding in encodings:
        try:
            df = pd.read_csv(csv_path, encoding=encoding)
            print(f"✓ Successfully read CSV with {encoding} encoding")
            break
        except UnicodeDecodeError:
            continue
        except Exception as e:
            print(f"Error with {encoding}: {e}")
            continue
    
    if df is None:
        raise ValueError("Could not read CSV with any supported encoding")
    
    print(f"Found {len(df)} employees in CSV")
    print(f"CSV Columns: {list(df.columns[:5])}...")  # Show first 5 columns
    
    # Replace NaN with None for proper JSON serialization
    df = df.replace({np.nan: None})
    
    uploaded_count = 0
    failed_count = 0
    skipped_count = 0
    
    # Process in batches
    for i in tqdm(range(0, len(df), batch_size), desc="Uploading employees"):
        batch = df.iloc[i:i + batch_size]
        
        for idx, row in batch.iterrows():
            try:
                # Get candidate_id
                candidate_id = get_value(row, 'Candidate ID')
                if not candidate_id:
                    candidate_id = f"CAND_{idx:05d}"
                    print(f"\n⚠️  Row {idx}: Missing candidate_id, generated: {candidate_id}")
                
                # Get full_name - REQUIRED field
                full_name = get_value(row, 'Candidate Full Name')
                if not full_name:
                    print(f"\n⚠️  Row {idx}: Skipping - missing full_name")
                    skipped_count += 1
                    continue
                
                # Create text for embedding
                employee_text = create_employee_text(row)
                
                # Generate embedding
                embedding = model.encode(employee_text).tolist()
                
                # Parse CTCs
                current_ctc_numeric = parse_ctc(get_value(row, 'Current CTC\u200b'))
                expected_ctc_numeric = parse_ctc(get_value(row, 'Expected CTC'))
                
                # Prepare employee data
                employee_data = {
                    'candidate_id': candidate_id,
                    'index_no': int(row.get('Index No')) if pd.notna(row.get('Index No')) else None,
                    'full_name': full_name,
                    'email': get_value(row, 'Email-ID'),
                    'phone_number': get_value(row, 'Phone Number'),
                    'alternate_phone': get_value(row, 'Alternate/Emergency Contact Number'),
                    'skill': get_value(row, 'Skill\u200b'),
                    'overall_experience': get_value(row, 'Overall Experience'),
                    'relevant_experience': get_value(row, 'Relevant Experience'),
                    'current_location': get_value(row, 'Current Location'),
                    'preferred_location': get_value(row, 'Preferred Location'),
                    'current_company': get_value(row, 'Current Company\u200b'),
                    'current_ctc': get_value(row, 'Current CTC\u200b'),
                    'expected_ctc': get_value(row, 'Expected CTC'),
                    'current_ctc_numeric': current_ctc_numeric,
                    'expected_ctc_numeric': expected_ctc_numeric,
                    'stage': get_value(row, 'Stage'),
                    'status': get_value(row, 'Status'),
                    'date_of_final_select': parse_date(get_value(row, 'Date Of Final Select')),
                    'doj': parse_date(get_value(row, 'DOJ')),
                    'resume_url': get_value(row, 'Resume/CV/Profile (Latest/Updated) (Attach Below)'),
                    'recruiter_name': get_value(row, 'Recruiter Name'),
                    'recruiter_name2': get_value(row, 'Recruiter Name2'),
                    'recruiter_comment': get_value(row, 'Recruiter Comment'),
                    'recruiter_email': get_value(row, 'Email'),
                    'account_manager': get_value(row, 'Account Manager\u200b'),
                    'account_manager_email': get_value(row, 'Account Manager Email'),
                    'team_lead': get_value(row, 'Team Lead'),
                    'client': get_value(row, 'Client'),
                    'client_spoc': get_value(row, 'Client SPOC'),
                    'requirement_id': get_value(row, 'REQUIREMENT ID:\u200b'),
                    'requirement_subject': get_value(row, 'Requirement Against which this profile is being submitted (Paste Subject Line)'),
                    'sourcing_channel': get_value(row, 'Sourcing channel'),
                    'sourcer_name': get_value(row, 'Sourcer Name ( Only Applies to Vendor )'),
                    'earliest_available_timings': get_value(row, 'Earliest Available timings for Interview'),
                    'notice_period': get_value(row, 'Notice Period/Last Working Day'),
                    'mode_of_hire': get_value(row, 'Mode Of Hire'),
                    'payroll': get_value(row, 'Payroll'),
                    'monthly_bill_rate': get_value(row, 'Monthly Bill Rate'),
                    'vendor_bill_rate': get_value(row, '(If Vendor) Vendor Bill Rate'),
                    'can_consider_virtual_bench': bool(get_value(row, 'Can this candidate be considered for the Virtual Bench List?')) if get_value(row, 'Can this candidate be considered for the Virtual Bench List?') else False,
                    'offered': bool(get_value(row, 'Offered')) if get_value(row, 'Offered') else False,
                    'onboarded': bool(get_value(row, 'Onboarded2')) if get_value(row, 'Onboarded2') else False,
                    'highest_education': get_value(row, 'Highest Education with Year (EG: BTECH - 2007)'),
                    'higher_education_year': int(row.get('Higher Education Completed in Year')) if pd.notna(row.get('Higher Education Completed in Year')) else None,
                    'dob': parse_date(get_value(row, 'DOB')),
                    'mail_to': get_value(row, 'MailTO'),
                    'mail_cc': get_value(row, 'MailCC'),
                    'email_stage': get_value(row, 'EmailStage'),
                    'mail_confirmation': get_value(row, 'Mail Confirmation'),
                    'start_time': parse_timestamp(get_value(row, 'Start time')),
                    'completion_time': parse_timestamp(get_value(row, 'Completion time')),
                    'sourced_date': parse_date(get_value(row, 'Sourced Date - DD/MM/YY.\u200b(Date during which candidate was sourced).Please note that the Submission date is automatically recorded in the database upon submitting this form.')),
                    'embedding': embedding
                }
                
                # Upload to Supabase (upsert to handle duplicates)
                response = supabase.table('employees_embed').upsert(
                    employee_data,
                    on_conflict='candidate_id'
                ).execute()
                
                uploaded_count += 1
                
            except Exception as e:
                print(f"\nError uploading employee {candidate_id if 'candidate_id' in locals() else 'unknown'}: {e}")
                failed_count += 1
                continue
    
    print(f"\n✅ Upload complete!")
    print(f"   Uploaded: {uploaded_count}")
    print(f"   Skipped: {skipped_count} (missing required fields)")
    print(f"   Failed: {failed_count}")
    print(f"   Total: {len(df)}")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python upload_employees.py <path_to_csv>")
        print("Example: python upload_employees.py employees.csv")
        sys.exit(1)
    
    csv_path = sys.argv[1]
    
    if not os.path.exists(csv_path):
        print(f"Error: File not found: {csv_path}")
        sys.exit(1)
    
    upload_employees(csv_path)
