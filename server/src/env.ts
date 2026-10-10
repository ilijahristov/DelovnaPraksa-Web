import path from 'node:path';

const isProduction = process.env.NODE_ENV === 'production';

export const env = {
  isProduction,
  port: Number(process.env.PORT) || 3000,
  // Passed to pg as separate fields, so the password needs no URL-encoding.
  db: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT) || 5432,
    user: process.env.POSTGRES_USER || 'courseshub',
    password: process.env.POSTGRES_PASSWORD || '',
    database: process.env.POSTGRES_DB || 'courseshub',
  },
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
