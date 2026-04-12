/**
 * CSV to Supabase Import Utility
 * Imports Kudzu Applicants CSV data into Supabase employees table
 * 
 * Usage:
 *   npm install csv-parse @supabase/supabase-js
 *   npx ts-node utils/import-csv-to-supabase.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment or use defaults
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ewzvahwdemjgqgtmoitj.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3enZhaHdkZW1qZ3FndG1vaXRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzMxODQsImV4cCI6MjA4Mjk0OTE4NH0.bCnN6UNspj3KBP1beJ2i5H5C4HYrxK82FyD8LfuakV8';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CSV_FILE_PATH = path.join(
  process.env.HOME || '', 
  'Downloads', 
  'Kudzu Applicants Tracking System V1.csv'
);

/**
 * Clean and normalize CSV value
 */
function cleanValue(value: any): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === 'z' || trimmed === 'NIL' || trimmed === '#N/A') {
    return null;
  }
  return trimmed;
}

/**
 * Parse date from various formats
 */
function parseDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const cleaned = cleanValue(dateStr);
  if (!cleaned) return null;
  
  try {
    // Try parsing common date formats
    const date = new Date(cleaned);
    if (isNaN(date.getTime())) return null;
    
    // Validate date is reasonable (between 1900 and 2100)
    const year = date.getFullYear();
    if (year < 1900 || year > 2100) return null;
    
    return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
  } catch {
    return null;
  }
}

/**
 * Parse timestamp with validation
 */
function parseTimestamp(tsStr: string | null | undefined): string | null {
  if (!tsStr) return null;
  const cleaned = cleanValue(tsStr);
  if (!cleaned) return null;
  
  try {
    const date = new Date(cleaned);
    if (isNaN(date.getTime())) return null;
    
    // Validate date is reasonable (between 1900 and 2100)
    const year = date.getFullYear();
    if (year < 1900 || year > 2100) return null;
    
    // Validate timezone offset is reasonable
    const isoString = date.toISOString();
    if (!isoString || isoString.includes('Invalid')) return null;
    
    return isoString;
  } catch {
    return null;
  }
}

/**
 * Convert CSV row to employee record
 */
function csvRowToEmployee(row: Record<string, any>) {
  return {
    candidate_id: cleanValue(row['Candidate ID']) || `candidate-${row['Id']}`,
    index_no: row['Index No'] ? parseInt(row['Index No']) : null,
    full_name: cleanValue(row['Candidate Full Name']) || 'Unknown Candidate',
    email: cleanValue(row['Email-ID']) || cleanValue(row['Email']),
    phone_number: cleanValue(row['Phone Number']),
    alternate_phone: cleanValue(row['Alternate/Emergency Contact Number']),
    skill: cleanValue(row['Skill']),
    overall_experience: cleanValue(row['Overall Experience']),
    relevant_experience: cleanValue(row['Relevant Experience']),
    current_location: cleanValue(row['Current Location']),
    preferred_location: cleanValue(row['Preferred Location']),
    current_company: cleanValue(row['Current Company']),
    current_ctc: cleanValue(row['Current CTC']),
    expected_ctc: cleanValue(row['Expected CTC']),
    stage: cleanValue(row['Stage']),
    status: cleanValue(row['Status']),
    date_of_final_select: parseDate(row['Date Of Final Select']),
    doj: parseDate(row['DOJ']),
    resume_url: cleanValue(row['Resume/CV/Profile (Latest/Updated) (Attach Below)']),
    recruiter_name: cleanValue(row['Recruiter Name']),
    recruiter_name2: cleanValue(row['Recruiter Name2']),
    recruiter_comment: cleanValue(row['Recruiter Comment']),
    recruiter_email: cleanValue(row['Email']),
    account_manager: cleanValue(row['Account Manager']),
    account_manager_email: cleanValue(row['Account Manager Email']),
    team_lead: cleanValue(row['Team Lead']),
    client: cleanValue(row['Client']),
    client_spoc: cleanValue(row['Client SPOC']),
    requirement_id: cleanValue(row['REQUIREMENT ID:']),
    requirement_subject: cleanValue(row['Requirement Against which this profile is being submitted (Paste Subject Line)']),
    sourcing_channel: cleanValue(row['Sourcing channel']),
    sourcer_name: cleanValue(row['Sourcer Name ( Only Applies to Vendor )']),
    earliest_available_timings: cleanValue(row['Earliest Available timings for Interview']),
    notice_period: cleanValue(row['Notice Period/Last Working Day']),
    last_working_day: parseDate(row['Notice Period/Last Working Day']),
    mode_of_hire: cleanValue(row['Mode Of Hire']),
    payroll: cleanValue(row['Payroll']),
    monthly_bill_rate: cleanValue(row['Monthly Bill Rate']),
    vendor_bill_rate: cleanValue(row['(If Vendor) Vendor Bill Rate']),
    can_consider_virtual_bench: cleanValue(row['Can this candidate be considered for the Virtual Bench List?'])?.toLowerCase() === 'yes',
    offered: cleanValue(row['Offered'])?.toLowerCase() === 'yes',
    onboarded: cleanValue(row['Onboarded2'])?.toLowerCase() === 'yes',
    highest_education: cleanValue(row['Highest Education with Year (EG: BTECH - 2007)']),
    higher_education_year: row['Higher Education Completed in Year'] ? parseInt(row['Higher Education Completed in Year']) : null,
    dob: parseDate(row['DOB']),
    mail_to: cleanValue(row['MailTO']),
    mail_cc: cleanValue(row['MailCC']),
    email_stage: cleanValue(row['EmailStage']),
    mail_confirmation: cleanValue(row['Mail Confirmation']),
    start_time: parseTimestamp(row['Start time']),
    completion_time: parseTimestamp(row['Completion time']),
    sourced_date: parseDate(row['Sourced Date - DD/MM/YY.(Date during which candidate was sourced).Please note that the Submission date is automatically recorded in the database upon submitting this form.']),
  };
}

/**
 * Import CSV data to Supabase
 */
async function importCSVToSupabase() {
  console.log('📊 Starting CSV to Supabase import\n');
  console.log(`Reading CSV from: ${CSV_FILE_PATH}\n`);
  
  // Check if file exists
  if (!fs.existsSync(CSV_FILE_PATH)) {
    console.error(`❌ CSV file not found at: ${CSV_FILE_PATH}`);
    console.log('\nPlease update CSV_FILE_PATH in this script to point to your CSV file.');
    return;
  }
  
  try {
    // Read and parse CSV
    const fileContent = fs.readFileSync(CSV_FILE_PATH, 'utf-8');
    const csvRows = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    });
    
    console.log(`✅ Successfully parsed ${csvRows.length} rows from CSV\n`);
    
    // Convert to employee records
    const employees = csvRows.map(csvRowToEmployee);
    
    // Remove duplicates within the dataset (keep first occurrence)
    const uniqueEmployees = new Map<string, typeof employees[0]>();
    for (const emp of employees) {
      if (!uniqueEmployees.has(emp.candidate_id)) {
        uniqueEmployees.set(emp.candidate_id, emp);
      }
    }
    const deduplicatedEmployees = Array.from(uniqueEmployees.values());
    
    console.log(`📋 Deduplicated: ${employees.length} → ${deduplicatedEmployees.length} unique employees\n`);
    
    // Process in batches to avoid overwhelming the database
    const BATCH_SIZE = 100;
    let imported = 0;
    let errors = 0;
    
    console.log(`📤 Importing ${deduplicatedEmployees.length} employees in batches of ${BATCH_SIZE}...\n`);
    
    for (let i = 0; i < deduplicatedEmployees.length; i += BATCH_SIZE) {
      const batch = deduplicatedEmployees.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(deduplicatedEmployees.length / BATCH_SIZE);
      
      // Remove duplicates within batch (shouldn't happen after deduplication, but safety check)
      const batchMap = new Map<string, typeof batch[0]>();
      for (const emp of batch) {
        if (!batchMap.has(emp.candidate_id)) {
          batchMap.set(emp.candidate_id, emp);
        }
      }
      const uniqueBatch = Array.from(batchMap.values());
      
      console.log(`Processing batch ${batchNum}/${totalBatches} (${uniqueBatch.length} records)...`);
      
      // Use upsert to handle duplicates (based on candidate_id)
      const { data, error } = await supabase
        .from('employees')
        .upsert(uniqueBatch, {
          onConflict: 'candidate_id',
          ignoreDuplicates: false,
        });
      
      if (error) {
        console.error(`❌ Error importing batch ${batchNum}:`, error.message);
        // Try inserting one by one to identify problematic records
        if (error.message.includes('ON CONFLICT DO UPDATE command cannot affect row a second time')) {
          console.log(`   Attempting individual inserts for batch ${batchNum}...`);
          let batchImported = 0;
          for (const emp of uniqueBatch) {
            const { error: singleError } = await supabase
              .from('employees')
              .upsert(emp, {
                onConflict: 'candidate_id',
                ignoreDuplicates: false,
              });
            if (!singleError) {
              batchImported++;
            }
          }
          imported += batchImported;
          errors += (uniqueBatch.length - batchImported);
        } else {
          errors += uniqueBatch.length;
        }
      } else {
        imported += uniqueBatch.length;
        console.log(`✅ Imported batch ${batchNum}: ${uniqueBatch.length} records`);
      }
    }
    
    console.log(`\n📊 Import Summary:`);
    console.log(`  Total records: ${employees.length}`);
    console.log(`  Successfully imported: ${imported}`);
    console.log(`  Errors: ${errors}`);
    
    // Update numeric CTC fields using the database function
    console.log(`\n🔄 Updating numeric CTC fields...`);
    const { data: updateResult, error: updateError } = await supabase
      .rpc('update_ctc_numeric_fields');
    
    if (updateError) {
      console.error(`❌ Error updating CTC fields:`, updateError.message);
    } else {
      console.log(`✅ Updated ${updateResult} records with numeric CTC values`);
    }
    
    console.log(`\n✅ Import complete!`);
    
  } catch (error) {
    console.error('❌ Error during import:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack:', error.stack);
    }
  }
}

// Run import if executed directly
if (require.main === module) {
  importCSVToSupabase();
}

export { importCSVToSupabase, csvRowToEmployee };
