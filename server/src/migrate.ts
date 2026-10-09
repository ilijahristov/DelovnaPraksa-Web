import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { prisma } from './db';
import { env } from './env';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// depends_on/service_healthy covers the normal case, but the stack can be
// woken from sleep with Postgres still starting, so keep trying for a while.
export async function waitForDatabase(attempts = 60, delayMs = 2000) {
  for (let attempt = 1; ; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch (err) {
      if (attempt >= attempts) throw err;
      console.log(`Database not reachable yet (attempt ${attempt}/${attempts}), retrying...`);
      await sleep(delayMs);
    }
  }
}

export async function runMigrations(attempts = 5) {
  // Resolved relative to src/ or dist/, both siblings of node_modules.
  const prismaCli = path.resolve(__dirname, '../node_modules/prisma/build/index.js');
  for (let attempt = 1; ; attempt++) {
    const result = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: env.databaseUrl },
    });
    if (result.status === 0) return;
    if (attempt >= attempts) throw new Error('prisma migrate deploy failed');
    console.log(`Migration failed (attempt ${attempt}/${attempts}), retrying...`);
    await sleep(3000);
  }
}
