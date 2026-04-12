/**
 * Audit Log Repository - Immutable append-only audit trail
 */

import { BaseRepository } from './base.repository.js';
import type pkg from 'pg';

export class AuditLogRepository extends BaseRepository {
  constructor() {
    super('audit_log');
  }

  async append(
    entry: {
      entity_type: string;
      entity_id: string;
      actor: string;
      action: string;
      note?: string;
      metadata?: object;
    },
    client?: pkg.PoolClient
  ): Promise<any> {
    const sql = `INSERT INTO audit_log (entity_type, entity_id, actor, action, note, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`;
    const params = [
      entry.entity_type,
      entry.entity_id,
      entry.actor,
      entry.action,
      entry.note || null,
      JSON.stringify(entry.metadata || {}),
    ];

    if (client) {
      const result = await client.query(sql, params);
      return result.rows[0];
    }
    const result = await this.query(sql, params);
    return result.rows[0];
  }

  async findByEntity(entityType: string, entityId: string): Promise<any[]> {
    const result = await this.query(
      `SELECT * FROM audit_log
       WHERE entity_type = $1 AND entity_id = $2
       ORDER BY timestamp DESC`,
      [entityType, entityId]
    );
    return result.rows;
  }

  async findRecent(limit: number = 50): Promise<any[]> {
    const result = await this.query(
      `SELECT al.*,
        CASE
          WHEN al.entity_type = 'ticket' THEN (SELECT title FROM tickets WHERE ticket_id = al.entity_id)
          WHEN al.entity_type = 'anomaly' THEN (SELECT severity::text FROM anomalies WHERE anomaly_id = al.entity_id)
          WHEN al.entity_type = 'asset' THEN (SELECT name FROM assets WHERE id = al.entity_id)
        END as entity_label
       FROM audit_log al
       ORDER BY al.timestamp DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }
}

export const auditLogRepository = new AuditLogRepository();
