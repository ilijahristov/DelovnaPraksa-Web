import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/db';

// Tests run against a real Postgres. Everything they create is tagged and removed.
const app = createApp();
const tag = `t${Date.now().toString(36)}`;
const emailFor = (who: string) => `${tag}-${who}@example.com`;
const PASSWORD = 'correct-horse-1';

async function createProfessor(who: string) {
  return prisma.user.create({
    data: {
      name: `Prof ${who}`,
      email: emailFor(who),
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      role: 'PROFESSOR',
    },
  });
}

async function loggedInAgent(who: string) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: emailFor(who), password: PASSWORD }).expect(200);
  return agent;
}

afterAll(async () => {
  await prisma.course.deleteMany({ where: { code: { startsWith: tag.toUpperCase() } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });
  await prisma.$disconnect();
});

describe('health', () => {
  it('GET /api/health returns 200', async () => {
    await request(app).get('/api/health').expect(200, { status: 'ok' });
  });
});

describe('auth', () => {
  it('signup always creates a STUDENT, even if a role is sent', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Test Student', email: emailFor('student'), password: PASSWORD, role: 'PROFESSOR' })
      .expect(201);

    expect(res.body.user.role).toBe('STUDENT');
    expect(res.body.user).not.toHaveProperty('passwordHash');
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/ch_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: emailFor('student') } });
    expect(stored.role).toBe('STUDENT');
    expect(stored.passwordHash).not.toBe(PASSWORD);
  });

  it('rejects a duplicate email and an invalid body', async () => {
    await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Again', email: emailFor('student'), password: PASSWORD })
      .expect(409);
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'X', email: 'not-an-email', password: 'short' })
      .expect(400);
    expect(Object.keys(res.body.fields)).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  it('logs in, reports the session, and logs out', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ email: emailFor('student'), password: 'wrong-password' })
      .expect(401);

    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: emailFor('student'), password: PASSWORD }).expect(200);
    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.user.email).toBe(emailFor('student'));

    await agent.post('/api/auth/logout').expect(204);
    const after = await agent.get('/api/auth/me').expect(200);
    expect(after.body.user).toBeNull();
  });
});

describe('role and ownership checks', () => {
  let courseId: number;

  beforeAll(async () => {
    await createProfessor('owner');
    await createProfessor('other');
  });

  it('requires login for course routes', async () => {
    await request(app).get('/api/courses').expect(401);
  });

  it('lets a professor create a course', async () => {
    const owner = await loggedInAgent('owner');
    const res = await owner
      .post('/api/courses')
      .send({ code: `${tag}-1`, title: 'Тест курс', description: 'Опис' })
      .expect(201);
    courseId = res.body.course.id;
    expect(res.body.course.code).toBe(`${tag}-1`.toUpperCase());
  });

  it('returns 403 when a student calls professor-only endpoints', async () => {
    const student = await loggedInAgent('student');
    await student.post('/api/courses').send({ code: `${tag}-2`, title: 'Не смее' }).expect(403);
    await student.patch(`/api/courses/${courseId}`).send({ title: 'Хак' }).expect(403);
    await student.delete(`/api/courses/${courseId}`).expect(403);
    await student
      .post(`/api/courses/${courseId}/materials`)
      .send({ title: 'Линк', url: 'https://example.com' })
      .expect(403);
    await student.get('/api/students').expect(403);
    await student.delete('/api/students/1').expect(403);
  });

  it('returns 403 when another professor edits a course they do not own', async () => {
    const other = await loggedInAgent('other');
    await other.patch(`/api/courses/${courseId}`).send({ title: 'Туѓ курс' }).expect(403);
    await other.get(`/api/courses/${courseId}/students`).expect(403);
  });

  it('lets the owner edit, add a link and enroll a student', async () => {
    const owner = await loggedInAgent('owner');
    await owner.patch(`/api/courses/${courseId}`).send({ title: 'Нов наслов' }).expect(200);
    await owner
      .post(`/api/courses/${courseId}/materials`)
      .send({ title: 'Скрипта', url: 'javascript:alert(1)' })
      .expect(400);
    await owner
      .post(`/api/courses/${courseId}/materials`)
      .send({ title: 'Документација', url: 'https://example.com/docs' })
      .expect(201);

    const student = await prisma.user.findUniqueOrThrow({ where: { email: emailFor('student') } });
    await owner.post(`/api/courses/${courseId}/students`).send({ userId: student.id }).expect(201);
    await owner.post(`/api/courses/${courseId}/students`).send({ userId: student.id }).expect(409);

    const studentAgent = await loggedInAgent('student');
    const mine = await studentAgent.get('/api/courses/mine').expect(200);
    expect(mine.body.courses.map((c: { id: number }) => c.id)).toContain(courseId);
  });
});
