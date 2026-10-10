import { pool } from '../src/db';
import { runMigrations, waitForDatabase } from '../src/migrate';

export default async function setup() {
  await waitForDatabase(5, 1000);
  await runMigrations();
  await pool.end();
}
