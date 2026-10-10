import { Link } from 'react-router-dom';
import { useApi } from '../api';
import { useCurrentUser } from '../auth';
import { CourseList } from '../components/CourseList';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../components/ui';
import type { CourseSummary } from '../types';

export function MyCoursesPage() {
  const user = useCurrentUser();
  const isProfessor = user.role === 'PROFESSOR';
  const { data, error, reload } = useApi<{ courses: CourseSummary[] }>('/courses/mine');

  return (
    <>
      <PageHeader
        title="Мои курсеви"
        subtitle={isProfessor ? 'Курсеви што ги водите.' : 'Курсеви на кои сте запишани.'}
        actions={
          isProfessor && (
            <Link to="/courses/new" className="btn btn-primary">
              Нов курс
            </Link>
          )
        }
      />
      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : !data ? (
        <LoadingState />
      ) : data.courses.length === 0 ? (
        isProfessor ? (
          <EmptyState
            title="Немате креирано курс"
            action={
              <Link to="/courses/new" className="btn btn-primary">
                Нов курс
              </Link>
            }
          />
        ) : (
          <EmptyState
            title="Не сте запишани на ниту еден курс"
            action={
              <Link to="/courses" className="btn btn-secondary">
                Сите курсеви
              </Link>
            }
          >
            На курс ве запишува професорот што го води.
          </EmptyState>
        )
      ) : (
        <CourseList courses={data.courses} />
      )}
    </>
  );
}
