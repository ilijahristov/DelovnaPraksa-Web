import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useDebounced } from '../api';
import { useCurrentUser } from '../auth';
import { CourseList } from '../components/CourseList';
import { EmptyState, ErrorState, LoadingState, PageHeader, plural, SearchInput, Spinner } from '../components/ui';
import type { CourseSummary } from '../types';

export function CoursesPage() {
  const user = useCurrentUser();
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim());
  const { data, error, loading, reload } = useApi<{ courses: CourseSummary[] }>(
    `/courses${q ? `?q=${encodeURIComponent(q)}` : ''}`,
  );
  const isProfessor = user.role === 'PROFESSOR';

  return (
    <>
      <PageHeader
        title="Курсеви"
        subtitle="Преглед на сите курсеви."
        actions={
          isProfessor && (
            <Link to="/courses/new" className="btn btn-primary">
              Нов курс
            </Link>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-full sm:max-w-sm">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Пребарај по код или наслов"
            label="Пребарај курсеви"
          />
        </div>
        {data && !error && (
          <span className="flex items-center gap-2 text-sm text-muted">
            {loading && <Spinner />}
            {plural(data.courses.length, 'курс', 'курсеви')}
          </span>
        )}
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : !data ? (
        <LoadingState />
      ) : data.courses.length === 0 ? (
        q ? (
          <EmptyState title="Нема резултати">
            Ниту еден курс не одговара на „{q}“.
          </EmptyState>
        ) : (
          <EmptyState
            title="Сè уште нема курсеви"
            action={
              isProfessor && (
                <Link to="/courses/new" className="btn btn-primary">
                  Нов курс
                </Link>
              )
            }
          />
        )
      ) : (
        <CourseList courses={data.courses} />
      )}
    </>
  );
}
