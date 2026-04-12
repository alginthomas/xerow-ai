/**
 * Anomaly Service - Severity scoring, detection, and ticket triggering
 * Implements the PRD severity rubric (Section 5)
 */

import { anomalyRepository, type AnomalyFilters } from '../repositories/anomaly.repository.js';
import { auditService } from './audit.service.js';
import { ticketService } from './ticket.service.js';
import { NotFoundError } from '../utils/errors.js';
import { buildPaginatedResult, type PaginatedResult } from '../utils/pagination.js';

/** Severity colour code mapping */
const SEVERITY_COLOURS: Record<string, string> = {
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#a855f7',
};

/**
 * Score severity based on PRD rubric (Section 5)
 */
function scoreSeverity(deviationPct: number, rateOfChange: number, confidenceScore: number, historicalMatches: number): {
  severity: string;
  colour_code: string;
} {
  // Purple: confidence < 60 or no historical match
  if (confidenceScore < 60 || historicalMatches === 0) {
    return { severity: 'purple', colour_code: SEVERITY_COLOURS.purple };
  }

  // Red: > 15% deviation or > 5x rate of change
  if (deviationPct > 15 || rateOfChange > 5) {
    return { severity: 'red', colour_code: SEVERITY_COLOURS.red };
  }

  // Amber: 5-15% deviation or > 2x rate of change, sustained > 15 min
  if (deviationPct > 5 || rateOfChange > 2) {
    return { severity: 'amber', colour_code: SEVERITY_COLOURS.amber };
  }

  // Green: deviation <= 5%, normal rate of change
  return { severity: 'green', colour_code: SEVERITY_COLOURS.green };
}

export const anomalyService = {
  async list(filters: AnomalyFilters): Promise<PaginatedResult<any>> {
    const limit = filters.limit || 20;
    const rows = await anomalyRepository.findAll(filters);
    return buildPaginatedResult(rows, limit, 'anomaly_id', 'detected_at');
  },

  async getById(anomalyId: string) {
    const anomaly = await anomalyRepository.findByIdWithDetails(anomalyId);
    if (!anomaly) throw new NotFoundError('Anomaly', anomalyId);

    // Attach audit log
    const auditLog = await auditService.getEntityHistory('anomaly', anomalyId);
    return { ...anomaly, audit_log: auditLog };
  },

  /**
   * Create a new anomaly from agent detection
   * Auto-triggers ticket creation for amber+ severity
   */
  async create(data: {
    asset_id: string;
    sensor_id: string;
    deviation_pct: number;
    rate_of_change?: number;
    confidence_score?: number;
    historical_matches?: number;
    data_snapshot: object;
    maintenance_window?: boolean;
  }, actor: string = 'analytics_agent') {
    const rateOfChange = data.rate_of_change || 1;
    const confidenceScore = data.confidence_score || 75;
    const historicalMatches = data.historical_matches ?? 5;

    const { severity, colour_code } = scoreSeverity(
      data.deviation_pct,
      rateOfChange,
      confidenceScore,
      historicalMatches
    );

    // Suppress green anomalies during maintenance windows
    if (severity === 'green' && data.maintenance_window) {
      return null;
    }

    const anomaly = await anomalyRepository.create({
      asset_id: data.asset_id,
      sensor_id: data.sensor_id,
      severity,
      colour_code,
      deviation_pct: data.deviation_pct,
      confidence_score: confidenceScore,
      data_snapshot: data.data_snapshot,
      maintenance_window: data.maintenance_window,
    });

    await auditService.log({
      entity_type: 'anomaly',
      entity_id: anomaly.anomaly_id,
      actor,
      action: 'detected',
      note: `${severity.toUpperCase()} anomaly detected: ${data.deviation_pct.toFixed(1)}% deviation, confidence ${confidenceScore}`,
      metadata: { severity, deviation_pct: data.deviation_pct, confidence_score: confidenceScore },
    });

    // Auto-create ticket for amber+ severity (PRD AN-03)
    if (severity !== 'green') {
      try {
        const ticket = await ticketService.createFromAnomaly(anomaly);
        await anomalyRepository.updateStatus(anomaly.anomaly_id, 'ticket_open', ticket.ticket_id);
      } catch (error) {
        console.error('Failed to create ticket for anomaly:', error);
      }
    }

    return anomaly;
  },

  async updateStatus(anomalyId: string, status: string, actor: string) {
    const anomaly = await anomalyRepository.findById(anomalyId, 'anomaly_id');
    if (!anomaly) throw new NotFoundError('Anomaly', anomalyId);

    const updated = await anomalyRepository.updateStatus(anomalyId, status);

    await auditService.log({
      entity_type: 'anomaly',
      entity_id: anomalyId,
      actor,
      action: `status_changed_to_${status}`,
      note: `Status changed from ${anomaly.status} to ${status}`,
    });

    return updated;
  },

  scoreSeverity,
  SEVERITY_COLOURS,
};
