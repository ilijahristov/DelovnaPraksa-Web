import { useState } from 'react';
import { api, formatDate, useApi, useDebounced } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState, PageHeader, SearchInput, Spinner } from '../components/ui';
import type { StudentAccount } from '../types';

function coursesLabel(n: number) {
  return n === 1 ? '1 курс' : `${n} курсеви`;
}

export function StudentsPage() {
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim());
  const { data, error, loading, reload } = useApi<{ students: StudentAccount[] }>(
    `/students${q ? `?q=${encodeURIComponent(q)}` : ''}`,
  );
  const [toDelete, setToDelete] = useState<StudentAccount | null>(null);

  async function deleteStudent(student: StudentAccount) {
    await api(`/students/${student.id}`, { method: 'DELETE' });
    setToDelete(null);
    reload();
  }

  return (
    <>
      <PageHeader title="Студенти" subtitle="Сите студентски профили на платформата." />
      <div className="mb-6 flex items-center gap-3">
        <div className="flex-1">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Пребарај по име или е-пошта…"
            label="Пребарај студенти"
          />
        </div>
        {loading && data && <Spinner className="h-4 w-4 text-ink-soft" />}
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : !data ? (
        <LoadingState />
      ) : data.students.length === 0 ? (
        <EmptyState title={q ? 'Нема пронајдени студенти' : 'Сè уште нема студенти'}>
          {q
            ? `Ниту еден студент не одговара на „${q}“.`
            : 'Студентите се појавуваат тука откако ќе се регистрираат.'}
        </EmptyState>
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-ink/10">
            {data.students.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="truncate text-sm text-ink-soft">{s.email}</p>
                </div>
                <div className="text-sm text-ink-soft sm:text-right">
                  <p>{coursesLabel(s.courseCount)}</p>
                  <p className="text-xs">Регистриран {formatDate(s.createdAt)}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost-danger btn-sm"
                  onClick={() => setToDelete(s)}
                >
                  Избриши
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Избриши профил?"
          confirmLabel="Избриши профил"
          onConfirm={() => deleteStudent(toDelete)}
          onClose={() => setToDelete(null)}
        >
          Профилот на <strong>{toDelete.name}</strong> ({toDelete.email}) и сите негови запишувања
          ќе бидат трајно избришани. Оваа акција не може да се врати.
        </ConfirmDialog>
      )}
    </>
  );
}
