/**
 * Asset Service - Business logic for asset management
 */

import { assetRepository, type AssetFilters } from '../repositories/asset.repository.js';
import { auditService } from './audit.service.js';
import { NotFoundError } from '../utils/errors.js';
import { buildPaginatedResult, type PaginatedResult } from '../utils/pagination.js';

export const assetService = {
  async list(filters: AssetFilters): Promise<PaginatedResult<any>> {
    const limit = filters.limit || 20;
    const rows = await assetRepository.findAll(filters);
    return buildPaginatedResult(rows, limit);
  },

  async getById(id: string) {
    const asset = await assetRepository.findByIdWithDetails(id);
    if (!asset) throw new NotFoundError('Asset', id);
    return asset;
  },

  async create(data: {
    name: string;
    type: string;
    region: string;
    location?: object;
    thresholds?: object;
    metadata?: object;
  }, actor: string) {
    const asset = await assetRepository.create(data);

    await auditService.log({
      entity_type: 'asset',
      entity_id: asset.id,
      actor,
      action: 'created',
      note: `Asset ${asset.name} (${asset.type}) created in ${asset.region}`,
    });

    return asset;
  },

  async update(id: string, data: Partial<{
    name: string;
    status: string;
    thresholds: object;
    metadata: object;
  }>, actor: string) {
    const existing = await assetRepository.findById(id);
    if (!existing) throw new NotFoundError('Asset', id);

    const updated = await assetRepository.update(id, data);

    await auditService.log({
      entity_type: 'asset',
      entity_id: id,
      actor,
      action: 'updated',
      note: `Asset updated: ${Object.keys(data).join(', ')}`,
      metadata: { changes: data },
    });

    return updated;
  },
};
