import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';
import { MSG } from '../messages';
import { parseId, searchTerm } from '../schemas';

export const studentsRouter = Router();

studentsRouter.use(requireAuth, requireRole('PROFESSOR'));

studentsRouter.get('/', async (req, res) => {
  const q = searchTerm(req.query.q);
  const students = await prisma.user.findMany({
    where: {
      role: 'STUDENT',
      ...(q && {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      _count: { select: { enrollments: true } },
    },
    orderBy: { name: 'asc' },
    take: 500,
  });
  res.json({
    students: students.map(({ _count, ...s }) => ({ ...s, courseCount: _count.enrollments })),
  });
});

// Only student accounts can be deleted; their enrollments cascade.
studentsRouter.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const { count } = id
    ? await prisma.user.deleteMany({ where: { id, role: 'STUDENT' } })
    : { count: 0 };
  if (!count) {
    res.status(404).json({ error: MSG.studentNotFound });
    return;
  }
  res.status(204).end();
});
