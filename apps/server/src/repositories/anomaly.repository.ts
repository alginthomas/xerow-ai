/**
 * Anomaly Repository - Data access for detected anomalies
 */

import { BaseRepository } from './base.repository.js';
import { decodeCursor } from '../utils/pagination.js';

export interface AnomalyFilters {
  asset_id?: string;
  sensor_id?: string;
  severity?: string | string[];
  status?: string | string[];
  date_from?: string;
  date_to?: string;
  cursor?: string;
  limit?: number;
}

export class AnomalyRepository extends BaseRepository {
  constructor() {
    super('anomalies');
  }

  async findAll(filters: AnomalyFilters = {}): Promise<any[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (filters.asset_id) {
      conditions.push(`an.asset_id = $${paramIdx++}`);
      params.push(filters.asset_id);
    }
    if (filters.sensor_id) {
      conditions.push(`an.sensor_id = $${paramIdx++}`);
      params.push(filters.sensor_id);
    }
    if (filters.severity) {
      const severities = Array.isArray(filters.severity) ? filters.severity : [filters.severity];
      conditions.push(`an.severity = ANY($${paramIdx++})`);
      params.push(severities);
    }
    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      conditions.push(`an.status = ANY($${paramIdx++})`);
      params.push(statuses);
    }
    if (filters.date_from) {
      conditions.push(`an.detected_at >= $${paramIdx++}`);
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      conditions.push(`an.detected_at <= $${paramIdx++}`);
      params.push(filters.date_to);
    }
    if (filters.cursor) {
      const decoded = decodeCursor(filters.cursor);
      conditions.push(`an.detected_at < $${paramIdx++}`);
      params.push(decoded.timestamp || decoded.id);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(filters.limit || 20, 100);

    const result = await this.query(
      `SELECT an.*,
        a.name as asset_name, a.type as asset_type,
        s.name as sensor_name, s.unit as sensor_unit
       FROM anomalies an
       JOIN assets a ON a.id = an.asset_id
       JOIN sensors s ON s.id = an.sensor_id
       ${where}
       ORDER BY an.detected_at DESC
       LIMIT $${paramIdx}`,
      [...params, limit + 1]
    );

    return result.rows;
  }

  async findByIdWithDetails(anomalyId: string): Promise<any | null> {
    const result = await this.query(
      `SELECT an.*,
        a.name as asset_name, a.type as asset_type, a.region,
        s.name as sensor_name, s.unit as sensor_unit, s.baseline_value,
        t.ticket_id, t.status as ticket_status, t.assigned_to, t.sla_deadline
       FROM anomalies an
       JOIN assets a ON a.id = an.asset_id
       JOIN sensors s ON s.id = an.sensor_id
       LEFT JOIN tickets t ON t.anomaly_id = an.anomaly_id
       WHERE an.anomaly_id = $1`,
      [anomalyId]
    );
    return result.rows[0] || null;
  }

  async create(data: {
    asset_id: string;
    sensor_id: string;
    severity: string;
    colour_code: string;
    deviation_pct: number;
    confidence_score: number;
    data_snapshot: object;
    maintenance_window?: boolean;
  }): Promise<any> {
    const result = await this.query(
      `INSERT INTO anomalies (asset_id, sensor_id, severity, colour_code, deviation_pct, confidence_score, data_snapshot, maintenance_window)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.asset_id,
        data.sensor_id,
        data.severity,
        data.colour_code,
        data.deviation_pct,
        data.confidence_score,
        JSON.stringify(data.data_snapshot),
        data.maintenance_window || false,
      ]
    );
    return result.rows[0];
  }

  async updateStatus(anomalyId: string, status: string, ticketId?: string): Promise<any> {
    const sets = ['status = $1'];
    const params: any[] = [status];
    let paramIdx = 2;

    if (ticketId) {
      sets.push(`ticket_id = $${paramIdx++}`);
      params.push(ticketId);
    }

    const result = await this.query(
      `UPDATE anomalies SET ${sets.join(', ')} WHERE anomaly_id = $${paramIdx} RETURNING *`,
      [...params, anomalyId]
    );
    return result.rows[0] || null;
  }
}

export const anomalyRepository = new AnomalyRepository();
