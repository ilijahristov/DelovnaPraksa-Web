import { Link } from 'react-router-dom';
import type { CourseSummary } from '../types';
import { CodeChip } from './ui';

export function CourseCard({ course }: { course: CourseSummary }) {
  return (
    <Link
      to={`/courses/${course.id}`}
      className="card group flex flex-col border-l-4 border-l-teal-deep p-5 transition hover:-translate-y-0.5 hover:border-l-amber hover:shadow-md"
    >
      <CodeChip code={course.code} />
      <h2 className="mt-3 text-lg leading-snug font-bold group-hover:text-teal-deep">
        {course.title}
      </h2>
      <p className="mt-1 text-sm text-ink-soft">{course.owner.name}</p>
      {course.description && (
        <p className="mt-3 line-clamp-3 text-sm text-ink/80">{course.description}</p>
      )}
    </Link>
  );
}

export function CourseGrid({ courses }: { courses: CourseSummary[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((course) => (
        <CourseCard key={course.id} course={course} />
      ))}
    </div>
  );
}
