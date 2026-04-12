/**
 * Base repository with shared data access patterns
 */

import { query, getClient } from '../database/connection.js';
import type pkg from 'pg';

export class BaseRepository {
  constructor(protected tableName: string) {}

  protected async query(text: string, params?: any[]): Promise<pkg.QueryResult> {
    return query(text, params);
  }

  protected async getClient(): Promise<pkg.PoolClient> {
    return getClient();
  }

  /**
   * Execute multiple queries within a transaction
   */
  async withTransaction<T>(fn: (client: pkg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(id: string, idColumn: string = 'id'): Promise<any | null> {
    const result = await this.query(
      `SELECT * FROM ${this.tableName} WHERE ${idColumn} = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async count(where?: string, params?: any[]): Promise<number> {
    const whereClause = where ? `WHERE ${where}` : '';
    const result = await this.query(
      `SELECT COUNT(*)::int as count FROM ${this.tableName} ${whereClause}`,
      params
    );
    return result.rows[0].count;
  }
}
