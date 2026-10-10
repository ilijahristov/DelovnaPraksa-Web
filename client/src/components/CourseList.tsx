import { Link } from 'react-router-dom';
import type { CourseSummary } from '../types';

const columns = 'sm:grid sm:grid-cols-[7rem_minmax(0,1fr)_13rem] sm:gap-4';

// Course table: code | title + short description | professor.
export function CourseList({ courses }: { courses: CourseSummary[] }) {
  return (
    <div className="panel overflow-hidden">
      <div
        className={`hidden border-b border-line bg-page/60 px-4 py-2 text-xs font-medium tracking-wide text-muted uppercase ${columns}`}
      >
        <span>Код</span>
        <span>Курс</span>
        <span>Професор</span>
      </div>
      <ul className="divide-y divide-line">
        {courses.map((course) => (
          <li key={course.id}>
            <Link
              to={`/courses/${course.id}`}
              className={`group block px-4 py-3 hover:bg-page/70 ${columns} sm:items-baseline`}
            >
              <span className="font-mono text-sm text-muted">{course.code}</span>
              <span className="block min-w-0">
                <span className="font-medium text-brand group-hover:underline">{course.title}</span>
                {course.description && (
                  <span className="mt-0.5 block truncate text-sm text-muted">{course.description}</span>
                )}
              </span>
              <span className="mt-1 block text-sm text-ink/80 sm:mt-0">{course.owner.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
