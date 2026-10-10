import type { Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne } from '../db';
import { env, requireEnv } from '../env';
import { MSG } from '../messages';
import { parseId } from '../schemas';

export const AUTH_COOKIE = 'ch_session';
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export type Role = 'STUDENT' | 'PROFESSOR';
export type AuthUser = { id: number; name: string; email: string; role: Role };
type OwnedCourse = { id: number; ownerId: number };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      course?: OwnedCourse;
    }
  }
}

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.cookieSecure,
  path: '/',
});

export function setAuthCookie(res: Response, user: AuthUser) {
  const token = jwt.sign({ sub: String(user.id) }, requireEnv('JWT_SECRET'), {
    expiresIn: TOKEN_TTL_SECONDS,
  });
  res.cookie(AUTH_COOKIE, token, { ...cookieOptions(), maxAge: TOKEN_TTL_SECONDS * 1000 });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE, cookieOptions());
}

// The token only carries the user id; the user is re-read on every request so
// deleted accounts lose access immediately and the role always comes from the DB.
export async function userFromRequest(req: Request): Promise<AuthUser | null> {
  const token: unknown = req.cookies?.[AUTH_COOKIE];
  if (typeof token !== 'string' || !token) return null;
  let id: number | null;
  try {
    const payload = jwt.verify(token, requireEnv('JWT_SECRET'));
    id = typeof payload === 'object' ? parseId(payload.sub) : null;
  } catch {
    return null;
  }
  if (!id) return null;
  const user = await queryOne<AuthUser>('SELECT id, name, email, role FROM users WHERE id = $1', [id]);
  return user ?? null;
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const user = await userFromRequest(req);
  if (!user) {
    res.status(401).json({ error: MSG.unauthenticated });
    return;
  }
  req.user = user;
  next();
};

export function requireRole(role: Role): RequestHandler {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      res.status(403).json({ error: MSG.forbidden });
      return;
    }
    next();
  };
}

// Use after requireAuth on routes with an :id course param.
export const requireCourseOwner: RequestHandler = async (req, res, next) => {
  const id = parseId(req.params.id);
  const course = id
    ? await queryOne<OwnedCourse>('SELECT id, owner_id AS "ownerId" FROM courses WHERE id = $1', [id])
    : undefined;
  if (!course) {
    res.status(404).json({ error: MSG.courseNotFound });
    return;
  }
  if (course.ownerId !== req.user?.id) {
    res.status(403).json({ error: MSG.forbidden });
    return;
  }
  req.course = course;
  next();
};
