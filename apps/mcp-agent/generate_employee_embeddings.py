"""
Generate embeddings for employee records.
Combines relevant employee fields into searchable text and generates vector embeddings.
"""

import logging
from typing import Dict, Any, List, Optional
from supabase_client import generate_embedding, supabase

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


def build_employee_embedding_text(employee: Dict[str, Any]) -> str:
    """
    Build searchable text from employee record for embedding generation.
    
    Combines relevant fields that should be searchable:
    - Name, skill, experience
    - Locations (current and preferred)
    - Company
    - Stage and status (for context)
    
    Args:
        employee: Employee record dictionary
        
    Returns:
        Combined text string for embedding
    """
    parts = []
    
    # Primary identifiers
    if employee.get('full_name'):
        parts.append(employee['full_name'])
    
    # Skills and experience
    if employee.get('skill'):
        parts.append(employee['skill'])
    
    if employee.get('overall_experience'):
        exp = employee['overall_experience']
        # Clean up experience values
        if exp and exp not in ['z', 'NIL', 'nil', '']:
            parts.append(f"{exp} years experience")
    
    if employee.get('relevant_experience'):
        rel_exp = employee['relevant_experience']
        if rel_exp and rel_exp not in ['z', 'NIL', 'nil', '']:
            parts.append(f"{rel_exp} years relevant experience")
    
    # Locations
    if employee.get('current_location'):
        parts.append(employee['current_location'])
    
    if employee.get('preferred_location'):
        parts.append(employee['preferred_location'])
    
    # Company
    if employee.get('current_company'):
        parts.append(employee['current_company'])
    
    # Stage and status for context (helps with filtering)
    if employee.get('stage'):
        parts.append(f"stage: {employee['stage']}")
    
    if employee.get('status'):
        parts.append(f"status: {employee['status']}")
    
    # Join all parts with spaces
    embedding_text = ' '.join(parts)
    
    # If we have no meaningful content, use a default
    if not embedding_text.strip():
        embedding_text = employee.get('full_name', 'employee')
    
    return embedding_text


def generate_employee_embedding(employee: Dict[str, Any]) -> List[float]:
    """
    Generate embedding vector for a single employee record.
    
    Args:
        employee: Employee record dictionary
        
    Returns:
        List of floats representing the embedding vector (384 dimensions)
    """
    embedding_text = build_employee_embedding_text(employee)
    embedding = generate_embedding(embedding_text)
    return embedding


def update_employee_embedding(employee_id: str, embedding: List[float]) -> bool:
    """
    Update a single employee record with its embedding.
    
    Args:
        employee_id: UUID of the employee record
        embedding: Embedding vector (list of floats)
        
    Returns:
        True if successful, False otherwise
    """
    try:
        response = supabase.table('employees').update({
            'embedding': embedding
        }).eq('id', employee_id).execute()
        
        if response.data:
            return True
        return False
    except Exception as e:
        logger.error(f"Error updating embedding for employee {employee_id}: {e}")
        return False


def generate_and_update_employee(employee: Dict[str, Any]) -> bool:
    """
    Generate embedding for an employee and update the database.
    
    Args:
        employee: Employee record dictionary with 'id' field
        
    Returns:
        True if successful, False otherwise
    """
    try:
        employee_id = employee.get('id')
        if not employee_id:
            logger.warning(f"Employee record missing 'id' field: {employee.get('candidate_id', 'unknown')}")
            return False
        
        # Generate embedding
        embedding = generate_employee_embedding(employee)
        
        # Update database
        success = update_employee_embedding(employee_id, embedding)
        
        if success:
            logger.debug(f"Generated embedding for {employee.get('full_name', employee.get('candidate_id', 'unknown'))}")
        
        return success
    except Exception as e:
        logger.error(f"Error generating embedding for employee {employee.get('candidate_id', 'unknown')}: {e}")
        return False


if __name__ == "__main__":
    # Example usage
    logger.info("Employee embedding generation module loaded")
    logger.info("Use migrate_employee_embeddings.py to batch process all employees")
