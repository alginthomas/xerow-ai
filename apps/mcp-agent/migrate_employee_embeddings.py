"""
Migration script to generate and update embeddings for all employees in the database.
Processes employees in batches with progress tracking and error handling.
"""

import logging
import time
from typing import List, Dict, Any
from supabase_client import supabase
from generate_employee_embeddings import generate_and_update_employee, build_employee_embedding_text

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# Configuration
BATCH_SIZE = 100  # Process employees in batches
DELAY_BETWEEN_BATCHES = 1  # Seconds to wait between batches (to avoid rate limiting)


def get_all_employees() -> List[Dict[str, Any]]:
    """
    Fetch all employees from the database.
    
    Returns:
        List of employee records
    """
    try:
        logger.info("Fetching all employees from database...")
        
        # Fetch all employees (Supabase has a default limit, so we'll paginate if needed)
        all_employees = []
        page_size = 1000
        offset = 0
        
        while True:
            response = supabase.table('employees').select('*').range(offset, offset + page_size - 1).execute()
            
            if not response.data:
                break
            
            all_employees.extend(response.data)
            logger.info(f"Fetched {len(all_employees)} employees so far...")
            
            if len(response.data) < page_size:
                break
            
            offset += page_size
        
        logger.info(f"Total employees fetched: {len(all_employees)}")
        return all_employees
    
    except Exception as e:
        logger.error(f"Error fetching employees: {e}")
        raise


def get_employees_without_embeddings() -> List[Dict[str, Any]]:
    """
    Fetch only employees that don't have embeddings yet.
    
    Returns:
        List of employee records without embeddings
    """
    try:
        logger.info("Fetching employees without embeddings...")
        
        all_employees = []
        page_size = 1000
        offset = 0
        
        while True:
            # Filter for employees where embedding is NULL
            response = supabase.table('employees').select('*').is_('embedding', 'null').range(offset, offset + page_size - 1).execute()
            
            if not response.data:
                break
            
            all_employees.extend(response.data)
            logger.info(f"Fetched {len(all_employees)} employees without embeddings so far...")
            
            if len(response.data) < page_size:
                break
            
            offset += page_size
        
        logger.info(f"Total employees without embeddings: {len(all_employees)}")
        return all_employees
    
    except Exception as e:
        logger.error(f"Error fetching employees without embeddings: {e}")
        raise


def process_batch(employees: List[Dict[str, Any]], batch_num: int, total_batches: int) -> tuple[int, int]:
    """
    Process a batch of employees, generating and updating embeddings.
    
    Args:
        employees: List of employee records to process
        batch_num: Current batch number (1-indexed)
        total_batches: Total number of batches
        
    Returns:
        Tuple of (successful_count, failed_count)
    """
    successful = 0
    failed = 0
    
    logger.info(f"Processing batch {batch_num}/{total_batches} ({len(employees)} employees)...")
    
    for i, employee in enumerate(employees, 1):
        try:
            candidate_id = employee.get('candidate_id', employee.get('id', 'unknown'))
            logger.debug(f"  [{i}/{len(employees)}] Processing {employee.get('full_name', candidate_id)}...")
            
            success = generate_and_update_employee(employee)
            
            if success:
                successful += 1
            else:
                failed += 1
                logger.warning(f"    Failed to update embedding for {candidate_id}")
        
        except Exception as e:
            failed += 1
            logger.error(f"    Error processing {employee.get('candidate_id', 'unknown')}: {e}")
    
    logger.info(f"Batch {batch_num} complete: {successful} successful, {failed} failed")
    return successful, failed


def migrate_all_employees(only_missing: bool = True) -> None:
    """
    Main migration function to process all employees.
    
    Args:
        only_missing: If True, only process employees without embeddings. 
                     If False, regenerate all embeddings.
    """
    try:
        # Fetch employees
        if only_missing:
            employees = get_employees_without_embeddings()
        else:
            employees = get_all_employees()
        
        if not employees:
            logger.info("No employees to process.")
            return
        
        total_employees = len(employees)
        logger.info(f"\n{'='*60}")
        logger.info(f"Starting migration for {total_employees} employees")
        logger.info(f"Batch size: {BATCH_SIZE}")
        logger.info(f"{'='*60}\n")
        
        # Process in batches
        total_successful = 0
        total_failed = 0
        total_batches = (total_employees + BATCH_SIZE - 1) // BATCH_SIZE
        
        start_time = time.time()
        
        for batch_num in range(1, total_batches + 1):
            start_idx = (batch_num - 1) * BATCH_SIZE
            end_idx = min(start_idx + BATCH_SIZE, total_employees)
            batch = employees[start_idx:end_idx]
            
            successful, failed = process_batch(batch, batch_num, total_batches)
            total_successful += successful
            total_failed += failed
            
            # Progress summary
            progress = (batch_num / total_batches) * 100
            logger.info(f"\nProgress: {progress:.1f}% | Successful: {total_successful} | Failed: {total_failed}\n")
            
            # Delay between batches (except for the last one)
            if batch_num < total_batches:
                time.sleep(DELAY_BETWEEN_BATCHES)
        
        elapsed_time = time.time() - start_time
        
        # Final summary
        logger.info(f"\n{'='*60}")
        logger.info("Migration Complete!")
        logger.info(f"{'='*60}")
        logger.info(f"Total employees processed: {total_employees}")
        logger.info(f"Successful: {total_successful}")
        logger.info(f"Failed: {total_failed}")
        logger.info(f"Time elapsed: {elapsed_time:.2f} seconds")
        logger.info(f"Average time per employee: {elapsed_time/total_employees:.2f} seconds")
        logger.info(f"{'='*60}\n")
    
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise


if __name__ == "__main__":
    import sys
    
    # Check command line arguments
    regenerate_all = False
    if len(sys.argv) > 1 and sys.argv[1] == "--all":
        regenerate_all = True
        logger.warning("Regenerating embeddings for ALL employees (including those that already have embeddings)")
    else:
        logger.info("Processing only employees without embeddings. Use --all to regenerate all.")
    
    try:
        migrate_all_employees(only_missing=not regenerate_all)
    except KeyboardInterrupt:
        logger.warning("\nMigration interrupted by user. Progress has been saved.")
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        sys.exit(1)
