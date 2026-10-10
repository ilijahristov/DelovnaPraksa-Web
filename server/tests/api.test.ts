import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { execute, pool, queryOne } from '../src/db';

// Tests run against a real Postgres. Everything they create is tagged and removed.
const app = createApp();
const tag = `t${Date.now().toString(36)}`;
const emailFor = (who: string) => `${tag}-${who}@example.com`;
const PASSWORD = 'correct-horse-1';

async function createProfessor(who: string) {
  await execute(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'PROFESSOR')`,
    [`Prof ${who}`, emailFor(who), await bcrypt.hash(PASSWORD, 4)],
  );
}

async function findUser(who: string) {
  const user = await queryOne<{ id: number; role: string; passwordHash: string }>(
    'SELECT id, role, password_hash AS "passwordHash" FROM users WHERE email = $1',
    [emailFor(who)],
  );
  if (!user) throw new Error(`user ${who} not found`);
  return user;
}

async function loggedInAgent(who: string) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: emailFor(who), password: PASSWORD }).expect(200);
  return agent;
}

afterAll(async () => {
  await execute('DELETE FROM courses WHERE code LIKE $1', [`${tag.toUpperCase()}%`]);
  await execute('DELETE FROM users WHERE email LIKE $1', [`${tag}%`]);
  await pool.end();
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

    const stored = await findUser('student');
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
    // A classic injection attempt is just a wrong email: queries are parameterized.
    await request(app)
      .post('/api/auth/login')
      .send({ email: "' OR '1'='1", password: "' OR '1'='1" })
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
    expect(res.body.course.owner.name).toBe('Prof owner');

    await owner.post('/api/courses').send({ code: `${tag}-1`, title: 'Дупликат' }).expect(409);
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
    // Editing only the title must keep the code and description.
    const patched = await owner.patch(`/api/courses/${courseId}`).send({ title: 'Нов наслов' }).expect(200);
    expect(patched.body.course).toMatchObject({
      code: `${tag}-1`.toUpperCase(),
      title: 'Нов наслов',
      description: 'Опис',
    });

    await owner
      .post(`/api/courses/${courseId}/materials`)
      .send({ title: 'Скрипта', url: 'javascript:alert(1)' })
      .expect(400);
    await owner
      .post(`/api/courses/${courseId}/materials`)
      .send({ title: 'Документација', url: 'https://example.com/docs' })
      .expect(201);

    const student = await findUser('student');
    await owner.post(`/api/courses/${courseId}/students`).send({ userId: student.id }).expect(201);
    await owner.post(`/api/courses/${courseId}/students`).send({ userId: student.id }).expect(409);

    const studentAgent = await loggedInAgent('student');
    const mine = await studentAgent.get('/api/courses/mine').expect(200);
    expect(mine.body.courses.map((c: { id: number }) => c.id)).toContain(courseId);

    const detail = await studentAgent.get(`/api/courses/${courseId}`).expect(200);
    expect(detail.body.course).toMatchObject({ isOwner: false, isEnrolled: true, enrolledCount: 1 });
    expect(detail.body.course.materials).toHaveLength(1);

    // Search is case-insensitive and treats % as a literal character.
    const found = await studentAgent.get(`/api/courses?q=${tag}`).expect(200);
    expect(found.body.courses).toHaveLength(1);
    const none = await studentAgent.get('/api/courses?q=%25%25%25').expect(200);
    expect(none.body.courses).toHaveLength(0);
  });

  it('removes enrollments and materials when a course or student is deleted', async () => {
    const owner = await loggedInAgent('owner');
    const student = await findUser('student');

    await owner.delete(`/api/students/${student.id}`).expect(204);
    const roster = await owner.get(`/api/courses/${courseId}/students`).expect(200);
    expect(roster.body.students).toHaveLength(0);

    await owner.delete(`/api/courses/${courseId}`).expect(204);
    const left = await queryOne<{ count: number }>(
      'SELECT count(*)::int AS count FROM materials WHERE course_id = $1',
      [courseId],
    );
    expect(left?.count).toBe(0);
  });
});
