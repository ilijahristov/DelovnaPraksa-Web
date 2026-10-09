import bcrypt from 'bcryptjs';
import { prisma } from './db';
import { requireEnv } from './env';

const DEMO_PROFESSORS = [
  { name: 'Ана Петровска', email: 'ana.petrovska@example.com' },
  { name: 'Марко Николовски', email: 'marko.nikolovski@example.com' },
];

const DEMO_STUDENTS = [
  { name: 'Елена Стојанова', email: 'elena.stojanova@example.com' },
  { name: 'Стефан Трајковски', email: 'stefan.trajkovski@example.com' },
  { name: 'Марија Илиевска', email: 'marija.ilievska@example.com' },
  { name: 'Никола Јованов', email: 'nikola.jovanov@example.com' },
  { name: 'Ивана Ристеска', email: 'ivana.risteska@example.com' },
  { name: 'Давид Костов', email: 'david.kostov@example.com' },
  { name: 'Сара Димитриевска', email: 'sara.dimitrievska@example.com' },
  { name: 'Филип Ангеловски', email: 'filip.angelovski@example.com' },
];

// owner: 0 = seed professor, 1..2 = DEMO_PROFESSORS
// students: indexes into DEMO_STUDENTS
const DEMO_COURSES = [
  {
    code: 'WEB101',
    title: 'Веб програмирање',
    description:
      'Основи на HTML, CSS и JavaScript, па изградба на интерактивни апликации со React и REST API.',
    owner: 0,
    students: [0, 1, 2, 3, 4],
    materials: [
      { title: 'MDN Web Docs', url: 'https://developer.mozilla.org/' },
      { title: 'React: Брз почеток', url: 'https://react.dev/learn' },
    ],
  },
  {
    code: 'DB201',
    title: 'Бази на податоци',
    description:
      'Релациски модел, SQL, нормализација, индекси и трансакции, со практична работа во PostgreSQL.',
    owner: 0,
    students: [0, 2, 5, 6],
    materials: [
      { title: 'PostgreSQL документација', url: 'https://www.postgresql.org/docs/current/' },
      { title: 'Prisma ORM документација', url: 'https://www.prisma.io/docs' },
    ],
  },
  {
    code: 'AL150',
    title: 'Алгоритми и структури на податоци',
    description:
      'Сортирање, пребарување, графови и динамичко програмирање, со анализа на сложеност.',
    owner: 1,
    students: [1, 3, 5, 7],
    materials: [
      { title: 'VisuAlgo: визуелизации на алгоритми', url: 'https://visualgo.net/en' },
      { title: 'Листа на алгоритми (Wikipedia)', url: 'https://en.wikipedia.org/wiki/List_of_algorithms' },
    ],
  },
  {
    code: 'OS210',
    title: 'Оперативни системи',
    description: 'Процеси, нишки, распоредување, меморија и датотечни системи.',
    owner: 1,
    students: [2, 4, 6],
    materials: [
      { title: 'Operating Systems: Three Easy Pieces', url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/' },
      { title: 'Linux man страници', url: 'https://man7.org/linux/man-pages/' },
    ],
  },
  {
    code: 'NET220',
    title: 'Компјутерски мрежи',
    description: 'Слоеви на мрежниот стек, TCP/IP, рутирање и протоколи на апликациско ниво.',
    owner: 2,
    students: [0, 3, 7],
    materials: [
      { title: 'Computer Networks: A Systems Approach', url: 'https://book.systemsapproach.org/' },
      { title: 'Преглед на HTTP (MDN)', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview' },
    ],
  },
  {
    code: 'SE301',
    title: 'Софтверско инженерство',
    description: 'Барања, дизајн, тестирање, верзионирање и тимска работа на софтверски проекти.',
    owner: 2,
    students: [1, 4, 5, 6, 7],
    materials: [
      { title: 'Pro Git (книга)', url: 'https://git-scm.com/book/en/v2' },
      { title: 'The Twelve-Factor App', url: 'https://12factor.net/' },
    ],
  },
];

export async function seed() {
  const email = requireEnv('SEED_PROFESSOR_EMAIL').trim().toLowerCase();
  const password = requireEnv('SEED_PROFESSOR_PASSWORD');
  const name = process.env.SEED_PROFESSOR_NAME?.trim() || 'Професор';

  let professor = await prisma.user.findUnique({ where: { email } });
  if (!professor) {
    professor = await prisma.user.create({
      data: { name, email, passwordHash: await bcrypt.hash(password, 10), role: 'PROFESSOR' },
    });
    console.log(`Seed: created professor ${email}`);
  }

  if (process.env.SEED_DEMO_DATA !== 'true') return;

  // Demo data is created once, in one transaction. The first demo professor is
  // the marker, so courses or students deleted later don't come back on restart.
  const marker = await prisma.user.findUnique({ where: { email: DEMO_PROFESSORS[0].email } });
  if (marker) return;

  // Demo accounts share the seed professor's password.
  const passwordHash = await bcrypt.hash(password, 10);
  const seedProfessorId = professor.id;
  await prisma.$transaction(async (tx) => {
    const upsertUser = (u: { name: string; email: string }, role: 'STUDENT' | 'PROFESSOR') =>
      tx.user.upsert({
        where: { email: u.email },
        update: {},
        create: { ...u, passwordHash, role },
      });

    const professors: { id: number }[] = [{ id: seedProfessorId }];
    for (const p of DEMO_PROFESSORS) professors.push(await upsertUser(p, 'PROFESSOR'));
    const students: { id: number }[] = [];
    for (const s of DEMO_STUDENTS) students.push(await upsertUser(s, 'STUDENT'));

    for (const c of DEMO_COURSES) {
      const existing = await tx.course.findUnique({ where: { code: c.code } });
      if (existing) continue;
      const course = await tx.course.create({
        data: {
          code: c.code,
          title: c.title,
          description: c.description,
          ownerId: professors[c.owner].id,
          materials: { create: c.materials },
        },
      });
      await tx.enrollment.createMany({
        data: c.students.map((i) => ({ userId: students[i].id, courseId: course.id })),
        skipDuplicates: true,
      });
    }
  });
  console.log('Seed: created demo professors, students, courses and enrollments');
}
