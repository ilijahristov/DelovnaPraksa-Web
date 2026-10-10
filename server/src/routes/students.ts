import { Router } from 'express';
import { containsPattern, execute, query } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';
import { MSG } from '../messages';
import { parseId, searchTerm } from '../schemas';

export const studentsRouter = Router();

studentsRouter.use(requireAuth, requireRole('PROFESSOR'));

const STUDENT_SELECT = `
  SELECT u.id, u.name, u.email, u.created_at AS "createdAt",
         (SELECT count(*)::int FROM enrollments e WHERE e.user_id = u.id) AS "courseCount"
  FROM users u
  WHERE u.role = 'STUDENT'`;

studentsRouter.get('/', async (req, res) => {
  const q = searchTerm(req.query.q);
  const students = q
    ? await query(
        `${STUDENT_SELECT} AND (u.name ILIKE $1 OR u.email ILIKE $1) ORDER BY u.name LIMIT 500`,
        [containsPattern(q)],
      )
    : await query(`${STUDENT_SELECT} ORDER BY u.name LIMIT 500`);
  res.json({ students });
});

// Only student accounts can be deleted; their enrollments cascade.
studentsRouter.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const deleted = id
    ? await execute(`DELETE FROM users WHERE id = $1 AND role = 'STUDENT'`, [id])
    : 0;
  if (!deleted) {
    res.status(404).json({ error: MSG.studentNotFound });
    return;
  }
  res.status(204).end();
});
