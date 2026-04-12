/**
 * Ticket Repository - Data access for agentic tickets
 */

import { BaseRepository } from './base.repository.js';
import { decodeCursor } from '../utils/pagination.js';

export interface TicketFilters {
  status?: string | string[];
  severity?: string | string[];
  assigned_to?: string;
  asset_id?: string;
  sla_breached?: boolean;
  cursor?: string;
  limit?: number;
}

export class TicketRepository extends BaseRepository {
  constructor() {
    super('tickets');
  }

  async findAll(filters: TicketFilters = {}): Promise<any[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      conditions.push(`t.status = ANY($${paramIdx++})`);
      params.push(statuses);
    }
    if (filters.severity) {
      const severities = Array.isArray(filters.severity) ? filters.severity : [filters.severity];
      conditions.push(`t.severity = ANY($${paramIdx++})`);
      params.push(severities);
    }
    if (filters.assigned_to) {
      conditions.push(`t.assigned_to = $${paramIdx++}`);
      params.push(filters.assigned_to);
    }
    if (filters.asset_id) {
      conditions.push(`t.asset_id = $${paramIdx++}`);
      params.push(filters.asset_id);
    }
    if (filters.sla_breached) {
      conditions.push(`t.sla_deadline < NOW() AND t.status NOT IN ('closed', 'false_positive')`);
    }
    if (filters.cursor) {
      const decoded = decodeCursor(filters.cursor);
      conditions.push(`t.created_at < $${paramIdx++}`);
      params.push(decoded.timestamp || decoded.id);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(filters.limit || 20, 100);

    const result = await this.query(
      `SELECT t.*,
        a.name as asset_name, a.type as asset_type,
        u.name as assigned_to_name, u.persona as assigned_to_persona,
        CASE WHEN t.sla_deadline < NOW() AND t.status NOT IN ('closed', 'false_positive')
          THEN true ELSE false END as sla_breached,
        EXTRACT(EPOCH FROM (t.sla_deadline - NOW()))::int as sla_remaining_seconds
       FROM tickets t
       JOIN assets a ON a.id = t.asset_id
       LEFT JOIN users u ON u.id = t.assigned_to
       ${where}
       ORDER BY
         CASE t.severity WHEN 'purple' THEN 0 WHEN 'red' THEN 1 WHEN 'amber' THEN 2 END,
         t.sla_deadline ASC
       LIMIT $${paramIdx}`,
      [...params, limit + 1]
    );

    return result.rows;
  }

  async findByIdWithDetails(ticketId: string): Promise<any | null> {
    const result = await this.query(
      `SELECT t.*,
        a.name as asset_name, a.type as asset_type, a.region,
        u.name as assigned_to_name, u.persona as assigned_to_persona,
        an.deviation_pct, an.confidence_score, an.data_snapshot, an.sensor_id,
        s.name as sensor_name, s.unit as sensor_unit,
        CASE WHEN t.sla_deadline < NOW() AND t.status NOT IN ('closed', 'false_positive')
          THEN true ELSE false END as sla_breached,
        EXTRACT(EPOCH FROM (t.sla_deadline - NOW()))::int as sla_remaining_seconds
       FROM tickets t
       JOIN assets a ON a.id = t.asset_id
       LEFT JOIN anomalies an ON an.anomaly_id = t.anomaly_id
       LEFT JOIN sensors s ON s.id = an.sensor_id
       LEFT JOIN users u ON u.id = t.assigned_to
       WHERE t.ticket_id = $1`,
      [ticketId]
    );
    return result.rows[0] || null;
  }

  async create(data: {
    anomaly_id: string;
    asset_id: string;
    severity: string;
    title: string;
    description?: string;
    assigned_to: string;
    sla_deadline: string;
  }): Promise<any> {
    const result = await this.query(
      `INSERT INTO tickets (anomaly_id, asset_id, severity, title, description, assigned_to, sla_deadline)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.anomaly_id,
        data.asset_id,
        data.severity,
        data.title,
        data.description || null,
        data.assigned_to,
        data.sla_deadline,
      ]
    );
    return result.rows[0];
  }

  async updateStatus(ticketId: string, updates: {
    status?: string;
    assigned_to?: string;
    escalation_level?: number;
    resolution_note?: string;
    classification_note?: string;
  }): Promise<any> {
    const sets: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let paramIdx = 1;

    if (updates.status !== undefined) {
      sets.push(`status = $${paramIdx++}`);
      params.push(updates.status);
      if (updates.status === 'closed' || updates.status === 'false_positive') {
        sets.push(`closed_at = NOW()`);
      }
    }
    if (updates.assigned_to !== undefined) { sets.push(`assigned_to = $${paramIdx++}`); params.push(updates.assigned_to); }
    if (updates.escalation_level !== undefined) { sets.push(`escalation_level = $${paramIdx++}`); params.push(updates.escalation_level); }
    if (updates.resolution_note !== undefined) { sets.push(`resolution_note = $${paramIdx++}`); params.push(updates.resolution_note); }
    if (updates.classification_note !== undefined) { sets.push(`classification_note = $${paramIdx++}`); params.push(updates.classification_note); }

    const result = await this.query(
      `UPDATE tickets SET ${sets.join(', ')} WHERE ticket_id = $${paramIdx} RETURNING *`,
      [...params, ticketId]
    );
    return result.rows[0] || null;
  }

  async findBreachedTickets(): Promise<any[]> {
    const result = await this.query(
      `SELECT t.*, a.name as asset_name, u.name as assigned_to_name
       FROM tickets t
       JOIN assets a ON a.id = t.asset_id
       LEFT JOIN users u ON u.id = t.assigned_to
       WHERE t.sla_deadline < NOW()
       AND t.status NOT IN ('closed', 'false_positive')
       ORDER BY t.severity, t.sla_deadline ASC`
    );
    return result.rows;
  }
}

export const ticketRepository = new TicketRepository();
