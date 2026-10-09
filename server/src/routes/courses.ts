import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, requireCourseOwner, requireRole } from '../middleware/auth';
import { isUniqueViolation } from '../middleware/errors';
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

const courseSummary = {
  id: true,
  code: true,
  title: true,
  description: true,
  createdAt: true,
  owner: { select: { id: true, name: true } },
} satisfies Prisma.CourseSelect;

const ownerOnly = [requireRole('PROFESSOR'), requireCourseOwner];

coursesRouter.use(requireAuth);

coursesRouter.get('/', async (req, res) => {
  const q = searchTerm(req.query.q);
  const courses = await prisma.course.findMany({
    where: q
      ? {
          OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { title: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined,
    select: courseSummary,
    orderBy: { code: 'asc' },
  });
  res.json({ courses });
});

// Students: courses they are enrolled in. Professors: courses they own.
coursesRouter.get('/mine', async (req, res) => {
  const user = req.user!;
  const courses = await prisma.course.findMany({
    where:
      user.role === 'PROFESSOR'
        ? { ownerId: user.id }
        : { enrollments: { some: { userId: user.id } } },
    select: courseSummary,
    orderBy: { code: 'asc' },
  });
  res.json({ courses });
});

coursesRouter.get('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const course = id
    ? await prisma.course.findUnique({
        where: { id },
        select: {
          ...courseSummary,
          ownerId: true,
          materials: {
            select: { id: true, title: true, url: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
          },
          _count: { select: { enrollments: true } },
        },
      })
    : null;
  if (!course) {
    res.status(404).json({ error: MSG.courseNotFound });
    return;
  }
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: req.user!.id, courseId: course.id } },
  });
  const { ownerId, _count, ...rest } = course;
  res.json({
    course: {
      ...rest,
      enrolledCount: _count.enrollments,
      isOwner: ownerId === req.user!.id,
      isEnrolled: Boolean(enrollment),
    },
  });
});

coursesRouter.post('/', requireRole('PROFESSOR'), async (req, res) => {
  const data = courseSchema.parse(req.body);
  try {
    const course = await prisma.course.create({
      data: { ...data, ownerId: req.user!.id },
      select: courseSummary,
    });
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
  const data = courseUpdateSchema.parse(req.body);
  try {
    const course = await prisma.course.update({
      where: { id: req.course!.id },
      data,
      select: courseSummary,
    });
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
  await prisma.course.delete({ where: { id: req.course!.id } });
  res.status(204).end();
});

coursesRouter.post('/:id/materials', ...ownerOnly, async (req, res) => {
  const data = materialSchema.parse(req.body);
  const material = await prisma.material.create({
    data: { ...data, courseId: req.course!.id },
    select: { id: true, title: true, url: true, createdAt: true },
  });
  res.status(201).json({ material });
});

coursesRouter.delete('/:id/materials/:materialId', ...ownerOnly, async (req, res) => {
  const materialId = parseId(req.params.materialId);
  const { count } = materialId
    ? await prisma.material.deleteMany({ where: { id: materialId, courseId: req.course!.id } })
    : { count: 0 };
  if (!count) {
    res.status(404).json({ error: MSG.materialNotFound });
    return;
  }
  res.status(204).end();
});

coursesRouter.get('/:id/students', ...ownerOnly, async (req, res) => {
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId: req.course!.id },
    select: { createdAt: true, user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { name: 'asc' } },
  });
  res.json({
    students: enrollments.map((e) => ({ ...e.user, enrolledAt: e.createdAt })),
  });
});

coursesRouter.post('/:id/students', ...ownerOnly, async (req, res) => {
  const { userId } = enrollSchema.parse(req.body);
  const student = await prisma.user.findFirst({
    where: { id: userId, role: 'STUDENT' },
    select: { id: true, name: true, email: true },
  });
  if (!student) {
    res.status(404).json({ error: MSG.studentNotFound });
    return;
  }
  try {
    const enrollment = await prisma.enrollment.create({
      data: { userId: student.id, courseId: req.course!.id },
    });
    res.status(201).json({ student: { ...student, enrolledAt: enrollment.createdAt } });
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
  const { count } = userId
    ? await prisma.enrollment.deleteMany({ where: { userId, courseId: req.course!.id } })
    : { count: 0 };
  if (!count) {
    res.status(404).json({ error: MSG.notEnrolled });
    return;
  }
  res.status(204).end();
});
