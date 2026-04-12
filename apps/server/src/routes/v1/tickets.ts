/**
 * Ticket API Routes - v1
 * Agentic ticket management with SLA tracking
 */

import express from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth.js';
import { ticketService } from '../../services/ticket.service.js';
import { auditService } from '../../services/audit.service.js';
import { parsePaginationParams } from '../../utils/pagination.js';

const router = express.Router();

/**
 * GET /api/v1/tickets
 * List tickets with filters (persona-aware)
 */
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { cursor, limit } = parsePaginationParams(req.query as any);
    const result = await ticketService.list(
      {
        status: req.query.status as string | string[],
        severity: req.query.severity as string | string[],
        assigned_to: req.query.assigned_to as string,
        asset_id: req.query.asset_id as string,
        sla_breached: req.query.sla_breached === 'true',
        cursor,
        limit,
      },
      req.userPersona,
      req.userId
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/tickets
 * Manually create a ticket (not from anomaly agent)
 */
router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { asset_id, title, severity, description, anomaly_id } = req.body;
    if (!asset_id || !title) {
      res.status(400).json({ error: { code: 'validation_error', message: 'asset_id and title are required' } });
      return;
    }

    const sev = severity || 'amber';

    // Find assignee by severity
    const { query } = await import('../../database/connection.js');
    const assignPersona = sev === 'purple' ? 'harry' : 'tom';
    const userResult = await query('SELECT id, name FROM users WHERE persona = $1 LIMIT 1', [assignPersona]);
    const assignee = userResult.rows[0];

    if (!assignee) {
      res.status(500).json({ error: { code: 'no_assignee', message: `No user with persona '${assignPersona}'` } });
      return;
    }

    const slaMs = sev === 'amber' ? 2 * 3600000 : sev === 'red' ? 1800000 : 600000;
    const slaDeadline = new Date(Date.now() + slaMs).toISOString();

    const ticketResult = await query(
      `INSERT INTO tickets (anomaly_id, asset_id, severity, title, description, assigned_to, sla_deadline)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [anomaly_id || null, asset_id, sev, title, description || null, assignee.id, slaDeadline]
    );

    const ticket = ticketResult.rows[0];

    await auditService.log({
      entity_type: 'ticket',
      entity_id: ticket.ticket_id,
      actor: req.userName || 'user',
      action: 'created_manually',
      note: `Manual ticket: ${title}. Assigned to ${assignee.name} (${assignPersona}).`,
    });

    res.status(201).json({ data: ticket });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/tickets/:id
 * Get ticket detail with full audit trail
 */
router.get('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const ticket = await ticketService.getById(req.params.id);
    res.json({ data: ticket });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/tickets/:id/acknowledge
 * Acknowledge a ticket (Tom action)
 */
router.post('/:id/acknowledge', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const ticket = await ticketService.acknowledge(
      req.params.id,
      req.userId!,
      req.userName || 'Unknown'
    );
    res.json({ data: ticket });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/tickets/:id/note
 * Add a field note to a ticket
 */
router.post('/:id/note', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { note } = req.body;
    if (!note) {
      res.status(400).json({ error: { code: 'validation_error', message: 'Note is required' } });
      return;
    }
    const ticket = await ticketService.addNote(
      req.params.id,
      note,
      req.userId!,
      req.userName || 'Unknown'
    );
    res.json({ data: ticket });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/tickets/:id/escalate
 * Escalate a ticket to the next persona tier
 */
router.post('/:id/escalate', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) {
      res.status(400).json({ error: { code: 'validation_error', message: 'Escalation reason is required' } });
      return;
    }
    const ticket = await ticketService.escalate(
      req.params.id,
      reason,
      req.userId!,
      req.userName || 'Unknown'
    );
    res.json({ data: ticket });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/tickets/:id/resolve
 * Resolve and close a ticket
 */
router.post('/:id/resolve', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { resolution_note, classification_note } = req.body;
    if (!resolution_note) {
      res.status(400).json({ error: { code: 'validation_error', message: 'Resolution note is required' } });
      return;
    }
    const ticket = await ticketService.resolve(
      req.params.id,
      resolution_note,
      classification_note,
      req.userId!,
      req.userName || 'Unknown'
    );
    res.json({ data: ticket });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/tickets/:id/audit
 * Get full audit trail for a ticket
 */
router.get('/:id/audit', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const auditLog = await auditService.getEntityHistory('ticket', req.params.id);
    res.json({ data: auditLog });
  } catch (error) {
    next(error);
  }
});

export { router as ticketRoutes };
