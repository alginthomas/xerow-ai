"""
Test script to verify employee embedding generation works.
Tests with a single employee record.
"""

import logging
from supabase_client import supabase
from generate_employee_embeddings import generate_and_update_employee, build_employee_embedding_text

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


def test_embedding_generation():
    """Test embedding generation with a single employee."""
    try:
        # Fetch one employee without embedding
        logger.info("Fetching a test employee...")
        response = supabase.table('employees').select('*').is_('embedding', 'null').limit(1).execute()
        
        if not response.data or len(response.data) == 0:
            logger.warning("No employees without embeddings found. Trying any employee...")
            response = supabase.table('employees').select('*').limit(1).execute()
        
        if not response.data or len(response.data) == 0:
            logger.error("No employees found in database!")
            return False
        
        employee = response.data[0]
        logger.info(f"Testing with employee: {employee.get('full_name', employee.get('candidate_id', 'unknown'))}")
        
        # Build embedding text
        embedding_text = build_employee_embedding_text(employee)
        logger.info(f"Embedding text: {embedding_text[:100]}...")
        
        # Generate and update embedding
        logger.info("Generating embedding...")
        success = generate_and_update_employee(employee)
        
        if success:
            logger.info("✅ Successfully generated and updated embedding!")
            
            # Verify it was saved
            verify_response = supabase.table('employees').select('embedding').eq('id', employee['id']).execute()
            if verify_response.data and verify_response.data[0].get('embedding'):
                logger.info("✅ Embedding verified in database!")
                return True
            else:
                logger.error("❌ Embedding not found in database after update")
                return False
        else:
            logger.error("❌ Failed to generate embedding")
            return False
    
    except Exception as e:
        logger.error(f"Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("Testing Employee Embedding Generation")
    logger.info("=" * 60)
    
    success = test_embedding_generation()
    
    if success:
        logger.info("\n✅ Test passed! You can now run migrate_employee_embeddings.py")
    else:
        logger.error("\n❌ Test failed! Please check the error messages above.")
        exit(1)
