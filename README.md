# CoursesHub

**Stack:** React + Vite + TypeScript + Tailwind (client) · Node + Express 5 + TypeScript (server) ·
PostgreSQL 16 with plain SQL (`pg` driver, no ORM) · Docker Compose. In production one `web` container serves the API under
`/api` and the built frontend (with SPA fallback) on port 3000; a `db` container runs Postgres.

## Features

| Role | Can do |
|---|---|
| Everyone | Sign up (always creates a **student**), log in, log out |
| Student | Browse/search all courses, open a course and its materials, see "My courses" (enrolled) |
| Professor | Create/edit/delete **own** courses, add/remove link materials, enroll/remove students on own courses, list and delete student accounts |

Roles and course ownership are enforced in server middleware (`requireAuth`, `requireRole`,
`requireCourseOwner`). Request bodies are validated with zod.


## Local run

Requirements: Docker Desktop (or Docker Engine + Compose v2).

```bash
cp .env.example .env        # then edit the four required values
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Open <http://localhost:3000> and log in with `SEED_PROFESSOR_EMAIL` / `SEED_PROFESSOR_PASSWORD`.
With the values from `.env.example` that is **Test Professor**: `test.professor@example.com` /
`clientclient`.
Set `SEED_DEMO_DATA=true` for 2 extra professors, 8 students and 6 courses. All demo accounts use
`SEED_PROFESSOR_PASSWORD`, e.g. `elena.stojanova@example.com` (student) or
`ana.petrovska@example.com` (professor).

Data lives in `./.stack-data/postgres` (git-ignored) and survives `docker compose down` / `up`.
To start from scratch, stop the stack and delete `.stack-data/`.

### Without Docker (hot reload)

With the dev stack's database running (`docker compose -f docker-compose.yml -f docker-compose.dev.yml up db`):

```bash
# terminal 1 – API on :3000 (uses POSTGRES_* vars, POSTGRES_HOST defaults to localhost)
cd server && npm install
POSTGRES_PASSWORD=... POSTGRES_PORT=5433 JWT_SECRET=dev-secret npm run dev

# terminal 2 – Vite on :5173, proxies /api to :3000
cd client && npm install && npm run dev
```

### Tests

A few API tests (auth, role and ownership checks) run against the dev database. They apply
migrations, create their own tagged users/courses and delete them afterwards.

```bash
cd server
POSTGRES_PASSWORD=<same as .env> POSTGRES_PORT=5433 npm test
```

## Environment variables

Compose passes everything through `${VAR}` references; there is no `env_file` and no committed `.env`.

| Variable | Required | Default | Description |
|---|---|---|---|
| `POSTGRES_PASSWORD` | **yes** | – | Database password (used by both `db` and `web`). Any characters are fine. |
| `JWT_SECRET` | **yes** | – | Secret for signing session tokens. Use a long random string (32+ chars). |
| `SEED_PROFESSOR_EMAIL` | **yes** | – | Email of the first professor, created on startup if missing. |
| `SEED_PROFESSOR_PASSWORD` | **yes** | – | Password for that professor (and for demo accounts). |
| `SEED_PROFESSOR_NAME` | no | `Професор` | Display name of the seeded professor. |
| `SEED_DEMO_DATA` | no | `false` | `true` creates demo professors, students, courses, links and enrollments. |
| `POSTGRES_USER` | no | `courseshub` | Database user. Only applied when the database is first created. |
| `POSTGRES_DB` | no | `courseshub` | Database name. Only applied when the database is first created. |
| `COOKIE_SECURE` | no | `true` | Secure flag on the session cookie. Keep `true` behind HTTPS. |

Generate a secret with e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

## What happens on container start

`node dist/start.js` (no manual steps needed):

1. Waits for Postgres (retries for ~2 minutes; the stack may be woken from sleep).
2. Applies the SQL migrations in `server/migrations/` that have not run yet (see below).
3. Runs the idempotent seed: the first professor is created only if missing. Demo data is created
   once in a single transaction, so demo courses or students you delete do not come back on restart.
4. Starts the server on `0.0.0.0:3000` (`GET /api/health` → 200), as the unprivileged `node` user.

## Database

The server talks to PostgreSQL directly through the `pg` driver. All queries are hand-written SQL
with `$1, $2…` placeholders (helpers in `server/src/db.ts`), so user input is never concatenated
into a query.

| Table | Columns |
|---|---|
| `users` | `id`, `name`, `email` (unique), `password_hash`, `role` (`STUDENT` \| `PROFESSOR`), `created_at` |
| `courses` | `id`, `code` (unique), `title`, `description`, `owner_id` → `users`, `created_at` |
| `enrollments` | `user_id` → `users`, `course_id` → `courses`, `created_at`; primary key (`user_id`, `course_id`) |
| `materials` | `id`, `course_id` → `courses`, `title`, `url`, `created_at` |

Deleting a course cascades to its enrollments and materials; deleting a student cascades to their
enrollments (`ON DELETE CASCADE`).

**Migrations** are numbered `.sql` files in `server/migrations/`. On start the app runs every file
that is not yet listed in the `schema_migrations` table, each in its own transaction, in file-name
order. To change the schema, add a new file (e.g. `003_add_something.sql`); never edit one that
has already been applied. `002_import_prisma_tables.sql` is a one-time carry-over for databases
created by the earlier Prisma version and does nothing on a fresh database.

## Deploying on RepoRun

The repo root contains what RepoRun expects: `docker-compose.yml` (services `web` and `db`, no
`ports`/`container_name`, persistent data under `./.stack-data/`, `db` healthcheck), `stack.yml`
(public ingress to `web:3000`) and a multi-stage `Dockerfile`.

1. **Connect the repo and branch:** in RepoRun, add this GitHub repository and choose the branch
   to deploy.
2. **Set Environment values:** add `POSTGRES_PASSWORD`, `JWT_SECRET`, `SEED_PROFESSOR_EMAIL` and
   `SEED_PROFESSOR_PASSWORD` (plus any optional variables from the table, e.g. `SEED_DEMO_DATA=true`).
3. **Validate:** run RepoRun's validation and fix anything it reports.
4. **Deploy:** RepoRun runs `docker compose up -d --build`. The first start migrates and seeds the
   database; open the app URL and log in as the seeded professor.

Changing `SEED_PROFESSOR_PASSWORD` later does not change an existing account's password, because
the seed only creates missing accounts.

## Project layout

```
docker-compose.yml       production stack (RepoRun)
docker-compose.dev.yml   local port mappings
stack.yml                RepoRun ingress
Dockerfile               client build → server build → slim runtime
server/
  migrations/            numbered SQL migrations
  src/start.ts           entrypoint: wait for DB → migrate → seed → listen
  src/db.ts              pg connection pool + query helpers
  src/migrate.ts         migration runner
  src/app.ts             Express app (API, static files, SPA fallback)
  src/middleware/        auth (JWT cookie, roles, ownership), error handling
  src/routes/            auth, courses (+ materials, enrollments), students
  src/seed.ts            idempotent seed
  tests/                 API tests (vitest + supertest)
client/
  src/pages/             Login, Signup, Courses, CourseDetail, MyCourses, CourseForm, Students
  src/components/        layout, UI primitives, confirm dialog, enrollment panel
```

## Scope notes

Materials are links only (no file uploads). Out of scope: email verification, password reset,
grades, assignments, notifications, multiple languages.
