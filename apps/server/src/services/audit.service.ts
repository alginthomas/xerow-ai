/**
 * Audit Service - Immutable logging for all entity actions
 */

import { auditLogRepository } from '../repositories/audit-log.repository.js';
import type pkg from 'pg';

export const auditService = {
  async log(
    entry: {
      entity_type: string;
      entity_id: string;
      actor: string;
      action: string;
      note?: string;
      metadata?: object;
    },
    client?: pkg.PoolClient
  ) {
    return auditLogRepository.append(entry, client);
  },

  async getEntityHistory(entityType: string, entityId: string) {
    return auditLogRepository.findByEntity(entityType, entityId);
  },

  async getRecentActivity(limit?: number) {
    return auditLogRepository.findRecent(limit);
  },
};
