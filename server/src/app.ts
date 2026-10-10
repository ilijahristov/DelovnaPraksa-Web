import cookieParser from 'cookie-parser';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { env } from './env';
import { errorHandler } from './middleware/errors';
import { MSG } from './messages';
import { authRouter } from './routes/auth';
import { coursesRouter } from './routes/courses';
import { studentsRouter } from './routes/students';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Behind Traefik: trust the first proxy hop for req.ip / req.protocol.
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api/auth', authRouter);
  app.use('/api/courses', coursesRouter);
  app.use('/api/students', studentsRouter);
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: MSG.notFound });
  });

  // Built frontend (present in the production image).
  const indexHtml = path.join(env.staticDir, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(
      '/assets',
      express.static(path.join(env.staticDir, 'assets'), { immutable: true, maxAge: '1y' }),
    );
    app.use(express.static(env.staticDir, { index: false }));
    // SPA fallback: every other GET renders the React app.
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
  }

  app.use(errorHandler);
  return app;
}
