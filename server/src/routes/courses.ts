import { Router } from 'express';
import { containsPattern, execute, isUniqueViolation, query, queryOne } from '../db';
import { requireAuth, requireCourseOwner, requireRole } from '../middleware/auth';
import { MSG } from '../messages';
import {
  courseSchema,
  courseUpdateSchema,
  enrollSchema,
  materialSchema,
  parseId,
  searchTerm,
} from '../schemas';

export const coursesRouter = Router();

type CourseSummary = {
  id: number;
  code: string;
  title: string;
  description: string;
  createdAt: Date;
  owner: { id: number; name: string };
};
type Material = { id: number; title: string; url: string; createdAt: Date };

// Shared SELECT for a course with its owner; callers append WHERE / ORDER BY.
const COURSE_SELECT = `
  SELECT c.id, c.code, c.title, c.description, c.created_at AS "createdAt",
         json_build_object('id', u.id, 'name', u.name) AS owner
  FROM courses c
  JOIN users u ON u.id = c.owner_id`;

const ownerOnly = [requireRole('PROFESSOR'), requireCourseOwner];

coursesRouter.use(requireAuth);

coursesRouter.get('/', async (req, res) => {
  const q = searchTerm(req.query.q);
  const courses = q
    ? await query<CourseSummary>(
        `${COURSE_SELECT} WHERE c.code ILIKE $1 OR c.title ILIKE $1 ORDER BY c.code`,
        [containsPattern(q)],
      )
    : await query<CourseSummary>(`${COURSE_SELECT} ORDER BY c.code`);
  res.json({ courses });
});

// Students: courses they are enrolled in. Professors: courses they own.
coursesRouter.get('/mine', async (req, res) => {
  const user = req.user!;
  const where =
    user.role === 'PROFESSOR'
      ? 'c.owner_id = $1'
      : 'EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id = c.id AND e.user_id = $1)';
  const courses = await query<CourseSummary>(`${COURSE_SELECT} WHERE ${where} ORDER BY c.code`, [
    user.id,
  ]);
  res.json({ courses });
});

coursesRouter.get('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const course = id
    ? await queryOne<CourseSummary & { enrolledCount: number; isOwner: boolean; isEnrolled: boolean }>(
        `SELECT c.id, c.code, c.title, c.description, c.created_at AS "createdAt",
                json_build_object('id', u.id, 'name', u.name) AS owner,
                (SELECT count(*)::int FROM enrollments e WHERE e.course_id = c.id) AS "enrolledCount",
                c.owner_id = $2 AS "isOwner",
                EXISTS (
                  SELECT 1 FROM enrollments e WHERE e.course_id = c.id AND e.user_id = $2
                ) AS "isEnrolled"
         FROM courses c
         JOIN users u ON u.id = c.owner_id
         WHERE c.id = $1`,
        [id, req.user!.id],
      )
    : undefined;
  if (!course) {
    res.status(404).json({ error: MSG.courseNotFound });
    return;
  }
  const materials = await query<Material>(
    `SELECT id, title, url, created_at AS "createdAt"
     FROM materials
     WHERE course_id = $1
     ORDER BY created_at, id`,
    [course.id],
  );
  res.json({ course: { ...course, materials } });
});

coursesRouter.post('/', requireRole('PROFESSOR'), async (req, res) => {
  const { code, title, description } = courseSchema.parse(req.body);
  try {
    const created = await queryOne<{ id: number }>(
      `INSERT INTO courses (code, title, description, owner_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [code, title, description, req.user!.id],
    );
    const course = await queryOne<CourseSummary>(`${COURSE_SELECT} WHERE c.id = $1`, [created!.id]);
    res.status(201).json({ course });
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: MSG.codeTaken, fields: { code: MSG.codeTaken } });
      return;
    }
    throw err;
  }
});

coursesRouter.patch('/:id', ...ownerOnly, async (req, res) => {
  const { code, title, description } = courseUpdateSchema.parse(req.body);
  const id = req.course!.id;
  try {
    // Fields that were not sent arrive as NULL and keep their current value.
    await execute(
      `UPDATE courses
       SET code = COALESCE($2, code),
           title = COALESCE($3, title),
           description = COALESCE($4, description)
       WHERE id = $1`,
      [id, code ?? null, title ?? null, description ?? null],
    );
    const course = await queryOne<CourseSummary>(`${COURSE_SELECT} WHERE c.id = $1`, [id]);
    res.json({ course });
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: MSG.codeTaken, fields: { code: MSG.codeTaken } });
      return;
    }
    throw err;
  }
});

// Enrollments and materials go with it (ON DELETE CASCADE).
coursesRouter.delete('/:id', ...ownerOnly, async (req, res) => {
  await execute('DELETE FROM courses WHERE id = $1', [req.course!.id]);
  res.status(204).end();
});

coursesRouter.post('/:id/materials', ...ownerOnly, async (req, res) => {
  const { title, url } = materialSchema.parse(req.body);
  const material = await queryOne<Material>(
    `INSERT INTO materials (course_id, title, url)
     VALUES ($1, $2, $3)
     RETURNING id, title, url, created_at AS "createdAt"`,
    [req.course!.id, title, url],
  );
  res.status(201).json({ material });
});

coursesRouter.delete('/:id/materials/:materialId', ...ownerOnly, async (req, res) => {
  const materialId = parseId(req.params.materialId);
  // course_id in the WHERE keeps an owner from deleting another course's material.
  const deleted = materialId
    ? await execute('DELETE FROM materials WHERE id = $1 AND course_id = $2', [
        materialId,
        req.course!.id,
      ])
    : 0;
  if (!deleted) {
    res.status(404).json({ error: MSG.materialNotFound });
    return;
  }
  res.status(204).end();
});

coursesRouter.get('/:id/students', ...ownerOnly, async (req, res) => {
  const students = await query(
    `SELECT u.id, u.name, u.email, e.created_at AS "enrolledAt"
     FROM enrollments e
     JOIN users u ON u.id = e.user_id
     WHERE e.course_id = $1
     ORDER BY u.name`,
    [req.course!.id],
  );
  res.json({ students });
});

coursesRouter.post('/:id/students', ...ownerOnly, async (req, res) => {
  const { userId } = enrollSchema.parse(req.body);
  const student = await queryOne<{ id: number; name: string; email: string }>(
    `SELECT id, name, email FROM users WHERE id = $1 AND role = 'STUDENT'`,
    [userId],
  );
  if (!student) {
    res.status(404).json({ error: MSG.studentNotFound });
    return;
  }
  try {
    const enrollment = await queryOne<{ enrolledAt: Date }>(
      `INSERT INTO enrollments (user_id, course_id)
       VALUES ($1, $2)
       RETURNING created_at AS "enrolledAt"`,
      [student.id, req.course!.id],
    );
    res.status(201).json({ student: { ...student, enrolledAt: enrollment!.enrolledAt } });
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: MSG.alreadyEnrolled });
      return;
    }
    throw err;
  }
});

coursesRouter.delete('/:id/students/:userId', ...ownerOnly, async (req, res) => {
  const userId = parseId(req.params.userId);
  const deleted = userId
    ? await execute('DELETE FROM enrollments WHERE user_id = $1 AND course_id = $2', [
        userId,
        req.course!.id,
      ])
    : 0;
  if (!deleted) {
    res.status(404).json({ error: MSG.notEnrolled });
    return;
  }
  res.status(204).end();
});
