/**
 * Agent Instance API Routes - v1
 * AI agent monitoring and management
 */

import express from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth.js';
import { query } from '../../database/connection.js';
import { auditService } from '../../services/audit.service.js';

const router = express.Router();

/**
 * GET /api/v1/agents
 * List all agent instances
 */
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const result = await query(
      `SELECT ai.*,
        a.name as asset_name, a.type as asset_type, a.region
       FROM agent_instances ai
       JOIN assets a ON a.id = ai.asset_id
       ORDER BY ai.status, ai.last_assessment DESC`
    );
    res.json({ data: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/agents/asset/:assetId
 * Get agents for a specific asset
 */
router.get('/asset/:assetId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const result = await query(
      `SELECT * FROM agent_instances
       WHERE asset_id = $1
       ORDER BY agent_type`,
      [req.params.assetId]
    );
    res.json({ data: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/agents/:id
 * Get agent detail with recent audit log
 */
router.get('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const result = await query(
      `SELECT ai.*,
        a.name as asset_name, a.type as asset_type
       FROM agent_instances ai
       JOIN assets a ON a.id = ai.asset_id
       WHERE ai.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: { code: 'not_found', message: 'Agent not found' } });
      return;
    }

    const auditLog = await auditService.getEntityHistory('agent', req.params.id);
    res.json({ data: { ...result.rows[0], audit_log: auditLog } });
  } catch (error) {
    next(error);
  }
});

export { router as agentRoutes };
