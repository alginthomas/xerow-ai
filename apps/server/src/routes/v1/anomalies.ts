/**
 * Anomaly API Routes - v1
 * Endpoints for anomaly detection records
 */

import express from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth.js';
import { anomalyService } from '../../services/anomaly.service.js';
import { parsePaginationParams } from '../../utils/pagination.js';

const router = express.Router();

/**
 * GET /api/v1/anomalies
 * List anomalies with filters
 */
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { cursor, limit } = parsePaginationParams(req.query as any);
    const result = await anomalyService.list({
      asset_id: req.query.asset_id as string,
      sensor_id: req.query.sensor_id as string,
      severity: req.query.severity as string | string[],
      status: req.query.status as string | string[],
      date_from: req.query.date_from as string,
      date_to: req.query.date_to as string,
      cursor,
      limit,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/anomalies/:id
 * Get anomaly detail with data snapshot and audit log
 */
router.get('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const anomaly = await anomalyService.getById(req.params.id);
    res.json({ data: anomaly });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/anomalies
 * Create anomaly (from agent detection)
 */
router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const anomaly = await anomalyService.create(req.body, req.userName || 'agent');
    if (!anomaly) {
      res.status(204).send(); // Suppressed (e.g., green during maintenance)
      return;
    }
    res.status(201).json({ data: anomaly });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/anomalies/:id/status
 * Update anomaly status (immutable core data, only status transitions)
 */
router.patch('/:id/status', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { status } = req.body;
    const anomaly = await anomalyService.updateStatus(
      req.params.id,
      status,
      req.userName || 'system'
    );
    res.json({ data: anomaly });
  } catch (error) {
    next(error);
  }
});

export { router as anomalyRoutes };
