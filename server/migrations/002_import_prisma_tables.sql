-- One-time carry-over from the earlier Prisma schema ("User", "Course",
-- "Enrollment", "Material"). Does nothing on a fresh database.

DO $$
BEGIN
  IF to_regclass('public."User"') IS NULL THEN
    RETURN;
  END IF;

  -- Prisma stored timestamps as UTC without a time zone.
  INSERT INTO users (id, name, email, password_hash, role, created_at)
  SELECT id, name, email, "passwordHash", role::text, "createdAt" AT TIME ZONE 'UTC'
  FROM "User";

  INSERT INTO courses (id, code, title, description, owner_id, created_at)
  SELECT id, code, title, description, "ownerId", "createdAt" AT TIME ZONE 'UTC'
  FROM "Course";

  INSERT INTO enrollments (user_id, course_id, created_at)
  SELECT "userId", "courseId", "createdAt" AT TIME ZONE 'UTC'
  FROM "Enrollment";

  INSERT INTO materials (id, course_id, title, url, created_at)
  SELECT id, "courseId", title, url, "createdAt" AT TIME ZONE 'UTC'
  FROM "Material";

  -- Ids were copied, so move the id sequences past them.
  PERFORM setval(pg_get_serial_sequence('users', 'id'), max(id)) FROM users HAVING max(id) IS NOT NULL;
  PERFORM setval(pg_get_serial_sequence('courses', 'id'), max(id)) FROM courses HAVING max(id) IS NOT NULL;
  PERFORM setval(pg_get_serial_sequence('materials', 'id'), max(id)) FROM materials HAVING max(id) IS NOT NULL;

  DROP TABLE "Material", "Enrollment", "Course", "User";
  DROP TYPE IF EXISTS "Role";
  DROP TABLE IF EXISTS "_prisma_migrations";
END
$$;
