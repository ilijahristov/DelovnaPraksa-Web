import { createApp } from './app';
import { pool } from './db';
import { env } from './env';

export function startServer() {
  const server = createApp().listen(env.port, '0.0.0.0', () => {
    console.log(`CoursesHub listening on 0.0.0.0:${env.port}`);
  });

  const shutdown = () => {
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  return server;
}

// `npm run dev` runs this file directly (no migrations or seed).
if (require.main === module) {
  startServer();
}
