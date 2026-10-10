// Container entrypoint: wait for DB -> migrate -> seed -> serve.
import { requireEnv } from './env';
import { startServer } from './index';
import { runMigrations, waitForDatabase } from './migrate';
import { seed } from './seed';

async function main() {
  // Fail fast with a clear message instead of on the first login.
  requireEnv('JWT_SECRET');

  await waitForDatabase();
  await runMigrations();
  await seed();
  startServer();
}

main().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
