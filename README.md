# CoursesHub

A small course-management web app (student project). Professors create courses,
add link materials and enroll students; students browse courses and open materials.
The UI is in Macedonian.

> Студентски проект, не е официјална страница на универзитет.

**Stack:** React + Vite + TypeScript + Tailwind (client) · Node + Express 5 + TypeScript (server) ·
PostgreSQL 16 + Prisma · Docker Compose. In production one `web` container serves the API under
`/api` and the built frontend (with SPA fallback) on port 3000; a `db` container runs Postgres.

## Features

| Role | Can do |
|---|---|
| Everyone | Sign up (always creates a **student**), log in, log out |
| Student | Browse/search all courses, open a course and its materials, see "My courses" (enrolled) |
| Professor | Create/edit/delete **own** courses, add/remove link materials, enroll/remove students on own courses, list and delete student accounts |

Roles and course ownership are enforced in server middleware (`requireAuth`, `requireRole`,
`requireCourseOwner`), not only in the UI. Request bodies are validated with zod.
Auth is a JWT in an httpOnly, SameSite=Lax cookie (Secure in production); passwords are bcrypt
hashes. There are no server-side sessions.

## Local run

Requirements: Docker Desktop (or Docker Engine + Compose v2).

```bash
cp .env.example .env        # then edit the four required values
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Open <http://localhost:3000> and log in with `SEED_PROFESSOR_EMAIL` / `SEED_PROFESSOR_PASSWORD`.
Set `SEED_DEMO_DATA=true` for 2 extra professors, 8 students and 6 courses. All demo accounts use
`SEED_PROFESSOR_PASSWORD`, e.g. `elena.stojanova@example.com` (student) or
`ana.petrovska@example.com` (professor).

`docker-compose.dev.yml` only adds the port mappings (web on 3000, Postgres on **5433** so it does
not clash with a locally installed PostgreSQL) and turns off the Secure cookie flag for plain-http
localhost. It is intentionally not called `docker-compose.override.yml`, which Compose would load
automatically on the server too.

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
2. Runs `prisma migrate deploy`.
3. Runs the idempotent seed: the first professor is created only if missing. Demo data is created
   once in a single transaction, so demo courses or students you delete do not come back on restart.
4. Starts the server on `0.0.0.0:3000` (`GET /api/health` → 200), as the unprivileged `node` user.

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
  prisma/                schema + migrations
  src/start.ts           entrypoint: wait for DB → migrate → seed → listen
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
