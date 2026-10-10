import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { MSG } from '../messages';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = String(issue.path[0] ?? '_');
      fields[key] ??= issue.message;
    }
    res.status(400).json({ error: MSG.invalid, fields });
    return;
  }
  // Malformed JSON or oversized body from express.json()
  if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
    res.status(400).json({ error: MSG.invalid });
    return;
  }
  console.error(err);
  res.status(500).json({ error: MSG.serverError });
};
