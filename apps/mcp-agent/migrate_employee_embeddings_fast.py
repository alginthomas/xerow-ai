"""
Optimized migration script with parallel processing for faster embedding generation.
Uses concurrent.futures to process multiple employees simultaneously.
"""

import logging
import time
from typing import List, Dict, Any
from concurrent.futures import ThreadPoolExecutor, as_completed
from supabase_client import supabase
from generate_employee_embeddings import generate_and_update_employee

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# Configuration - optimized for speed
BATCH_SIZE = 500  # Larger batches for database queries
WORKER_THREADS = 10  # Process 10 employees concurrently
DELAY_BETWEEN_BATCHES = 0.5  # Reduced delay


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


def process_employee(employee: Dict[str, Any]) -> tuple[bool, str]:
    """
    Process a single employee, generating and updating embedding.
    
    Args:
        employee: Employee record dictionary
        
    Returns:
        Tuple of (success, employee_id)
    """
    try:
        candidate_id = employee.get('candidate_id', employee.get('id', 'unknown'))
        success = generate_and_update_employee(employee)
        return success, candidate_id
    except Exception as e:
        logger.error(f"Error processing {employee.get('candidate_id', 'unknown')}: {e}")
        return False, employee.get('candidate_id', 'unknown')


def process_batch_parallel(employees: List[Dict[str, Any]], batch_num: int, total_batches: int) -> tuple[int, int]:
    """
    Process a batch of employees in parallel using ThreadPoolExecutor.
    
    Args:
        employees: List of employee records to process
        batch_num: Current batch number (1-indexed)
        total_batches: Total number of batches
        
    Returns:
        Tuple of (successful_count, failed_count)
    """
    successful = 0
    failed = 0
    
    logger.info(f"Processing batch {batch_num}/{total_batches} ({len(employees)} employees) with {WORKER_THREADS} workers...")
    
    # Use ThreadPoolExecutor for parallel processing
    with ThreadPoolExecutor(max_workers=WORKER_THREADS) as executor:
        # Submit all tasks
        future_to_employee = {
            executor.submit(process_employee, employee): employee 
            for employee in employees
        }
        
        # Process completed tasks
        for future in as_completed(future_to_employee):
            employee = future_to_employee[future]
            try:
                success, candidate_id = future.result()
                if success:
                    successful += 1
                else:
                    failed += 1
                    logger.warning(f"    Failed: {candidate_id}")
            except Exception as e:
                failed += 1
                logger.error(f"    Exception processing {employee.get('candidate_id', 'unknown')}: {e}")
    
    logger.info(f"Batch {batch_num} complete: {successful} successful, {failed} failed")
    return successful, failed


def migrate_all_employees(only_missing: bool = True) -> None:
    """
    Main migration function to process all employees with parallel processing.
    
    Args:
        only_missing: If True, only process employees without embeddings. 
                     If False, regenerate all embeddings.
    """
    try:
        # Fetch employees
        employees = get_employees_without_embeddings()
        
        if not employees:
            logger.info("No employees to process.")
            return
        
        total_employees = len(employees)
        logger.info(f"\n{'='*60}")
        logger.info(f"Starting FAST migration for {total_employees} employees")
        logger.info(f"Batch size: {BATCH_SIZE}")
        logger.info(f"Worker threads: {WORKER_THREADS}")
        logger.info(f"Expected speedup: ~{WORKER_THREADS}x faster")
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
            
            batch_start = time.time()
            successful, failed = process_batch_parallel(batch, batch_num, total_batches)
            batch_time = time.time() - batch_start
            
            total_successful += successful
            total_failed += failed
            
            # Progress summary
            progress = (batch_num / total_batches) * 100
            rate = len(batch) / batch_time if batch_time > 0 else 0
            logger.info(f"\nProgress: {progress:.1f}% | Successful: {total_successful} | Failed: {total_failed}")
            logger.info(f"Batch time: {batch_time:.1f}s | Rate: {rate:.1f} employees/sec\n")
            
            # Small delay between batches (except for the last one)
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
        logger.info(f"Time elapsed: {elapsed_time:.2f} seconds ({elapsed_time/60:.1f} minutes)")
        logger.info(f"Average time per employee: {elapsed_time/total_employees:.3f} seconds")
        logger.info(f"Processing rate: {total_employees/elapsed_time:.1f} employees/second")
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
    
    # Allow customizing worker threads
    if len(sys.argv) > 2:
        try:
            WORKER_THREADS = int(sys.argv[2])
            logger.info(f"Using {WORKER_THREADS} worker threads (custom)")
        except ValueError:
            logger.warning(f"Invalid worker thread count: {sys.argv[2]}, using default {WORKER_THREADS}")
    
    try:
        migrate_all_employees(only_missing=not regenerate_all)
    except KeyboardInterrupt:
        logger.warning("\nMigration interrupted by user. Progress has been saved.")
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        sys.exit(1)
