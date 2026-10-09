import path from 'node:path';

const isProduction = process.env.NODE_ENV === 'production';

// Built from the POSTGRES_* parts (URL-encoded) so passwords with special
// characters work. An explicit DATABASE_URL wins, e.g. for local tooling.
function buildDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const user = encodeURIComponent(process.env.POSTGRES_USER || 'courseshub');
  const password = encodeURIComponent(process.env.POSTGRES_PASSWORD || '');
  const host = process.env.POSTGRES_HOST || 'localhost';
  const port = process.env.POSTGRES_PORT || '5432';
  const db = encodeURIComponent(process.env.POSTGRES_DB || 'courseshub');
  return `postgresql://${user}:${password}@${host}:${port}/${db}?schema=public`;
}

export const env = {
  isProduction,
  port: Number(process.env.PORT) || 3000,
  databaseUrl: buildDatabaseUrl(),
  cookieSecure: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : isProduction,
  staticDir: process.env.STATIC_DIR || path.resolve(__dirname, '../public'),
};

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}
