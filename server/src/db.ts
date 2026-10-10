import { Pool } from 'pg';
import type { PoolClient, QueryResultRow } from 'pg';
import { env } from './env';

export const pool = new Pool({ ...env.db, max: 10 });

// An idle connection can drop (e.g. Postgres restarts while the stack sleeps).
// Without a listener that would crash the process; the pool just reconnects.
pool.on('error', (err) => {
  console.error('Idle database connection error:', err.message);
});

// Anything that can run a query: the pool, or a client inside a transaction.
export type Db = Pick<PoolClient, 'query'>;

// All SQL goes through these helpers with $1, $2... placeholders. Values are
// never concatenated into the query text.
export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
  db: Db = pool,
): Promise<T[]> {
  const result = await db.query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
  db: Db = pool,
): Promise<T | undefined> {
  return (await query<T>(text, params, db))[0];
}

// For INSERT/UPDATE/DELETE without RETURNING: number of affected rows.
export async function execute(text: string, params: unknown[] = [], db: Db = pool): Promise<number> {
  const result = await db.query(text, params);
  return result.rowCount ?? 0;
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Postgres error code for a UNIQUE constraint violation.
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

// Turns a search term into an ILIKE pattern, escaping the LIKE wildcards.
export function containsPattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, '\\$&')}%`;
}
