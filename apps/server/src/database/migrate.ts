/**
 * Database Migration Runner
 * Executes numbered SQL migration files in order
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, getClient } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureMigrationsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      executed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function getExecutedMigrations(): Promise<Set<string>> {
  const result = await query('SELECT name FROM _migrations ORDER BY id');
  return new Set(result.rows.map((r: { name: string }) => r.name));
}

async function getMigrationFiles(): Promise<string[]> {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
  return files;
}

export async function runMigrations(): Promise<void> {
  await ensureMigrationsTable();
  const executed = await getExecutedMigrations();
  const files = await getMigrationFiles();

  const pending = files.filter(f => !executed.has(f));

  if (pending.length === 0) {
    console.log('No pending migrations.');
    return;
  }

  console.log(`Running ${pending.length} migration(s)...`);

  for (const file of pending) {
    const client = await getClient();
    try {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`  ✅ ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`  ❌ ${file}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  console.log('All migrations complete.');
}

// Run directly if called as script
if (process.argv[1]?.includes('migrate')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
