/**
 * Shift Summary API — Auto-generated briefing for shift handover
 */

import express from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth.js';
import { query } from '../../database/connection.js';

const router = express.Router();

/**
 * GET /api/v1/shift/summary
 * Returns a shift summary for the last 8 hours (or custom window)
 */
router.get('/summary', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const hours = parseInt(req.query.hours as string) || 8;

    const [anomalyRes, ticketRes, resolvedRes, breachedRes, assetRes] = await Promise.all([
      query(
        `SELECT severity, COUNT(*)::int as count FROM anomalies
         WHERE detected_at > NOW() - INTERVAL '${hours} hours'
         GROUP BY severity ORDER BY count DESC`
      ),
      query(
        `SELECT COUNT(*)::int as count FROM tickets
         WHERE created_at > NOW() - INTERVAL '${hours} hours'`
      ),
      query(
        `SELECT COUNT(*)::int as count FROM tickets
         WHERE closed_at > NOW() - INTERVAL '${hours} hours'
         AND status IN ('closed', 'false_positive')`
      ),
      query(
        `SELECT COUNT(*)::int as count FROM tickets
         WHERE sla_deadline < NOW()
         AND status NOT IN ('closed', 'false_positive')`
      ),
      query(
        `SELECT status, COUNT(*)::int as count FROM assets
         GROUP BY status`
      ),
    ]);

    const anomaliesBySeverity: Record<string, number> = {};
    let totalAnomalies = 0;
    for (const row of anomalyRes.rows) {
      anomaliesBySeverity[row.severity] = row.count;
      totalAnomalies += row.count;
    }

    const assetStatus: Record<string, number> = {};
    for (const row of assetRes.rows) {
      assetStatus[row.status] = row.count;
    }

    res.json({
      data: {
        window_hours: hours,
        anomalies: {
          total: totalAnomalies,
          by_severity: anomaliesBySeverity,
        },
        tickets: {
          new: ticketRes.rows[0]?.count || 0,
          resolved: resolvedRes.rows[0]?.count || 0,
          sla_breached: breachedRes.rows[0]?.count || 0,
        },
        assets: assetStatus,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

export { router as shiftRoutes };
