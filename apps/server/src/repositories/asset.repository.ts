/**
 * Asset Repository - Data access for monitored field assets
 */

import { BaseRepository } from './base.repository.js';
import { decodeCursor } from '../utils/pagination.js';

export interface AssetFilters {
  type?: string;
  region?: string;
  status?: string;
  cursor?: string;
  limit?: number;
}

export class AssetRepository extends BaseRepository {
  constructor() {
    super('assets');
  }

  async findAll(filters: AssetFilters = {}): Promise<any[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (filters.type) {
      conditions.push(`type = $${paramIdx++}`);
      params.push(filters.type);
    }
    if (filters.region) {
      conditions.push(`region = $${paramIdx++}`);
      params.push(filters.region);
    }
    if (filters.status) {
      conditions.push(`status = $${paramIdx++}`);
      params.push(filters.status);
    }
    if (filters.cursor) {
      const decoded = decodeCursor(filters.cursor);
      conditions.push(`id < $${paramIdx++}`);
      params.push(decoded.id);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(filters.limit || 20, 100);

    const result = await this.query(
      `SELECT a.*,
        (SELECT COUNT(*)::int FROM sensors s WHERE s.asset_id = a.id) as sensor_count,
        (SELECT COUNT(*)::int FROM tickets t WHERE t.asset_id = a.id AND t.status NOT IN ('closed', 'false_positive')) as open_ticket_count,
        (SELECT COUNT(*)::int FROM anomalies an WHERE an.asset_id = a.id AND an.detected_at > NOW() - INTERVAL '24 hours') as recent_anomaly_count
       FROM assets a
       ${where}
       ORDER BY a.created_at DESC
       LIMIT $${paramIdx}`,
      [...params, limit + 1]
    );

    return result.rows;
  }

  async findByIdWithDetails(id: string): Promise<any | null> {
    const result = await this.query(
      `SELECT a.*,
        (SELECT json_agg(s.*) FROM sensors s WHERE s.asset_id = a.id) as sensors,
        (SELECT COUNT(*)::int FROM tickets t WHERE t.asset_id = a.id AND t.status NOT IN ('closed', 'false_positive')) as open_ticket_count,
        (SELECT COUNT(*)::int FROM anomalies an WHERE an.asset_id = a.id AND an.detected_at > NOW() - INTERVAL '24 hours') as recent_anomaly_count
       FROM assets a
       WHERE a.id = $1
       GROUP BY a.id`,
      [id]
    );
    return result.rows[0] || null;
  }

  async create(data: {
    name: string;
    type: string;
    region: string;
    location?: object;
    status?: string;
    thresholds?: object;
    metadata?: object;
  }): Promise<any> {
    const result = await this.query(
      `INSERT INTO assets (name, type, region, location, status, thresholds, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.name,
        data.type,
        data.region,
        JSON.stringify(data.location || {}),
        data.status || 'operational',
        JSON.stringify(data.thresholds || {}),
        JSON.stringify(data.metadata || {}),
      ]
    );
    return result.rows[0];
  }

  async update(id: string, data: Partial<{
    name: string;
    status: string;
    thresholds: object;
    metadata: object;
  }>): Promise<any> {
    const sets: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (data.name !== undefined) { sets.push(`name = $${paramIdx++}`); params.push(data.name); }
    if (data.status !== undefined) { sets.push(`status = $${paramIdx++}`); params.push(data.status); }
    if (data.thresholds !== undefined) { sets.push(`thresholds = $${paramIdx++}`); params.push(JSON.stringify(data.thresholds)); }
    if (data.metadata !== undefined) { sets.push(`metadata = $${paramIdx++}`); params.push(JSON.stringify(data.metadata)); }

    sets.push(`updated_at = NOW()`);

    const result = await this.query(
      `UPDATE assets SET ${sets.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      [...params, id]
    );
    return result.rows[0] || null;
  }
}

export const assetRepository = new AssetRepository();
