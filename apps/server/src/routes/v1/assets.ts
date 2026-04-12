/**
 * Asset API Routes - v1
 * RESTful endpoints for monitored field assets
 */

import express from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth.js';
import { assetService } from '../../services/asset.service.js';
import { sensorDataService } from '../../services/sensor-data.service.js';
import { anomalyRepository } from '../../repositories/anomaly.repository.js';
import { ticketRepository } from '../../repositories/ticket.repository.js';
import { parsePaginationParams } from '../../utils/pagination.js';
import { ApiError } from '../../utils/errors.js';

const router = express.Router();

/**
 * GET /api/v1/assets
 * List assets with optional filters
 */
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { cursor, limit } = parsePaginationParams(req.query as any);
    const result = await assetService.list({
      type: req.query.type as string,
      region: req.query.region as string,
      status: req.query.status as string,
      cursor,
      limit,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/assets/:id
 * Get asset detail with sensors, anomaly count, ticket count
 */
router.get('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const asset = await assetService.getById(req.params.id);
    res.json({ data: asset });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/assets/:id/sensors/:sensorId/readings
 * Get time-series sensor readings
 */
router.get('/:id/sensors/:sensorId/readings', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { sensorId } = req.params;
    const from = (req.query.from as string) || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const to = (req.query.to as string) || new Date().toISOString();
    const interval = (req.query.interval as string) || '5m';

    const readings = await sensorDataService.getReadings(sensorId, from, to, interval);
    res.json({ data: readings });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/assets/:id/anomalies
 * Get anomaly history for an asset
 */
router.get('/:id/anomalies', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { cursor, limit } = parsePaginationParams(req.query as any);
    const rows = await anomalyRepository.findAll({
      asset_id: req.params.id,
      severity: req.query.severity as string,
      cursor,
      limit,
    });
    const has_next = rows.length > limit;
    res.json({
      data: has_next ? rows.slice(0, limit) : rows,
      meta: { has_next, next_cursor: null },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/assets/:id/tickets
 * Get tickets for an asset
 */
router.get('/:id/tickets', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { cursor, limit } = parsePaginationParams(req.query as any);
    const rows = await ticketRepository.findAll({
      asset_id: req.params.id,
      status: req.query.status as string,
      cursor,
      limit,
    });
    const has_next = rows.length > limit;
    res.json({
      data: has_next ? rows.slice(0, limit) : rows,
      meta: { has_next, next_cursor: null },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/assets
 * Create a new asset
 */
router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const asset = await assetService.create(req.body, req.userName || 'system');
    res.status(201).json({ data: asset });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/assets/:id
 * Update an asset
 */
router.patch('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const asset = await assetService.update(req.params.id, req.body, req.userName || 'system');
    res.json({ data: asset });
  } catch (error) {
    next(error);
  }
});

export { router as assetRoutes };
