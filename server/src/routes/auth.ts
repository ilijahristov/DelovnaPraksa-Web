import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { isUniqueViolation, queryOne } from '../db';
import { clearAuthCookie, setAuthCookie, userFromRequest } from '../middleware/auth';
import type { AuthUser } from '../middleware/auth';
import { MSG } from '../messages';
import { loginSchema, signupSchema } from '../schemas';

export const authRouter = Router();

// Compared against when the email is unknown, so both cases take the same time.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

authRouter.post('/signup', async (req, res) => {
  // The schema has no role field: unknown keys (including "role") are stripped,
  // and the INSERT hard-codes STUDENT.
  const { name, email, password } = signupSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const user = await queryOne<AuthUser>(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'STUDENT')
       RETURNING id, name, email, role`,
      [name, email, passwordHash],
    );
    setAuthCookie(res, user!);
    res.status(201).json({ user });
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: MSG.emailTaken, fields: { email: MSG.emailTaken } });
      return;
    }
    throw err;
  }
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const found = await queryOne<AuthUser & { passwordHash: string }>(
    'SELECT id, name, email, role, password_hash AS "passwordHash" FROM users WHERE email = $1',
    [email],
  );
  const ok = await bcrypt.compare(password, found?.passwordHash ?? DUMMY_HASH);
  if (!found || !ok) {
    res.status(401).json({ error: MSG.badLogin });
    return;
  }
  const user = { id: found.id, name: found.name, email: found.email, role: found.role };
  setAuthCookie(res, user);
  res.json({ user });
});

authRouter.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.status(204).end();
});

authRouter.get('/me', async (req, res) => {
  res.json({ user: await userFromRequest(req) });
});
