import fs from 'node:fs';
import path from 'node:path';
import { pool, query } from './db';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Resolved relative to src/ or dist/, both siblings of migrations/.
const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

// depends_on/service_healthy covers the normal case, but the stack can be
// woken from sleep with Postgres still starting, so keep trying for a while.
export async function waitForDatabase(attempts = 60, delayMs = 2000) {
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      if (attempt >= attempts) throw err;
      console.log(`Database not reachable yet (attempt ${attempt}/${attempts}), retrying...`);
      await sleep(delayMs);
    }
  }
}

// Applies migrations/*.sql in file-name order. Each file runs once, in its own
// transaction, and is recorded in schema_migrations.
export async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const applied = new Set(
    (await query<{ name: string }>('SELECT name FROM schema_migrations')).map((row) => row.name),
  );
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`Migration applied: ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
    } finally {
      client.release();
    }
  }
}
