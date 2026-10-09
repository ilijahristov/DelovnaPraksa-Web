import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useDebounced } from '../api';
import { useCurrentUser } from '../auth';
import { CourseGrid } from '../components/CourseCard';
import { EmptyState, ErrorState, LoadingState, PageHeader, SearchInput, Spinner } from '../components/ui';
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
        subtitle="Сите курсеви на платформата."
        actions={
          isProfessor && (
            <Link to="/courses/new" className="btn btn-primary">
              + Нов курс
            </Link>
          )
        }
      />
      <div className="mb-6 flex items-center gap-3">
        <div className="flex-1">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Пребарај по код или наслов…"
            label="Пребарај курсеви"
          />
        </div>
        {loading && data && <Spinner className="h-4 w-4 text-ink-soft" />}
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : !data ? (
        <LoadingState />
      ) : data.courses.length === 0 ? (
        q ? (
          <EmptyState title="Нема пронајдени курсеви">
            Ниту еден курс не одговара на „{q}“. Обидете се со друг код или наслов.
          </EmptyState>
        ) : (
          <EmptyState
            title="Сè уште нема курсеви"
            action={
              isProfessor && (
                <Link to="/courses/new" className="btn btn-primary">
                  Креирај го првиот курс
                </Link>
              )
            }
          >
            Курсевите ќе се појават тука штом професорите ги додадат.
          </EmptyState>
        )
      ) : (
        <CourseGrid courses={data.courses} />
      )}
    </>
  );
}
