/**
 * Employee Routes
 * API endpoints for employee data
 */

import express from 'express';
import { query } from '../database/connection.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

/**
 * Async error wrapper to ensure errors are properly caught
 */
const asyncHandler = (fn: express.RequestHandler) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * GET /api/employees/:id
 * Get employee details by ID or candidate_id
 * Returns all employee fields for the details dialog
 */
router.get('/:id', asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log('[Employee API] Fetching employee with ID:', id);

    if (!id) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }

    // Try to find by candidate_id first (more common), then by UUID id
    // Select all columns explicitly to ensure we get everything
    // Use ILIKE for case-insensitive matching on candidate_id
    const result = await query(
      `SELECT 
        id,
        candidate_id,
        full_name,
        email,
        phone_number,
        alternate_phone,
        skill,
        overall_experience,
        relevant_experience,
        current_location,
        preferred_location,
        current_company,
        current_ctc,
        expected_ctc,
        current_ctc_numeric,
        expected_ctc_numeric,
        stage,
        status,
        resume_url,
        recruiter_name,
        recruiter_comment,
        recruiter_email,
        earliest_available_timings,
        notice_period,
        date_of_final_select,
        doj,
        created_at,
        updated_at
       FROM employees 
       WHERE candidate_id = $1 OR candidate_id ILIKE $1 OR id::text = $1 
       LIMIT 1`,
      [id]
    );

    if (result.rows.length === 0) {
      console.log('[Employee API] Employee not found:', id);
      return res.status(404).json({ error: 'Employee not found' });
    }

    const employee = result.rows[0];
    console.log('[Employee API] Returning employee data for:', id);
    console.log('[Employee API] Employee fields:', Object.keys(employee));
    console.log('[Employee API] Email:', employee.email);
    console.log('[Employee API] Phone:', employee.phone_number);
    console.log('[Employee API] Skill:', employee.skill);
    console.log('[Employee API] Location:', employee.current_location);

    return res.json(employee);
  } catch (error: any) {
    console.error('[Employee API] Error fetching employee:', error);
    console.error('[Employee API] Error stack:', error.stack);
    console.error('[Employee API] Error message:', error.message);
    
    // Ensure we always return JSON, even on error
    if (!res.headersSent) {
      return res.status(500).json({ 
        error: 'Failed to fetch employee details',
        message: error.message || 'Unknown error',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      });
    }
    
    // If headers already sent, pass to Express error handler
    next(error);
  }
}));

export { router as employeeRoutes };
