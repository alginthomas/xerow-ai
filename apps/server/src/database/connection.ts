/**
 * PostgreSQL Database Connection
 * Uses pg library for direct PostgreSQL access
 */

import pkg from 'pg';
const { Pool } = pkg;

// Lazy pool initialization - create on first use, not at module load
let pool: pkg.Pool | null = null;

function getPool(): pkg.Pool {
  if (!pool) {
    const poolConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'xerow',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

    pool = new Pool(poolConfig);
    
    // Test connection
    pool.on('connect', () => {
      console.log('✅ Connected to PostgreSQL database');
    });

    pool.on('error', (err: Error) => {
      console.error('❌ PostgreSQL connection error:', err);
    });
  }
  return pool;
}

/**
 * Execute a query
 */
export async function query(text: string, params?: any[]): Promise<pkg.QueryResult> {
  const start = Date.now();
  const poolInstance = getPool();
  
  try {
    const res = await poolInstance.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Query error:', { text, error });
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 */
export function getClient(): Promise<pkg.PoolClient> {
  return getPool().connect();
}

/**
 * Close all connections
 */
export async function close(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export default getPool;
