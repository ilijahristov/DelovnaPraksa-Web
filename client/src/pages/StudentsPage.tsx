import { useState } from 'react';
import { api, formatDate, useApi, useDebounced } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState, PageHeader, plural, SearchInput, Spinner } from '../components/ui';
import type { StudentAccount } from '../types';

const columns = 'sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_6rem_9rem_5rem] sm:gap-4';

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
      <PageHeader title="Студенти" subtitle="Студентски профили на платформата." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-full sm:max-w-sm">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Пребарај по име или е-пошта"
            label="Пребарај студенти"
          />
        </div>
        {data && !error && (
          <span className="flex items-center gap-2 text-sm text-muted">
            {loading && <Spinner />}
            {plural(data.students.length, 'студент', 'студенти')}
          </span>
        )}
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : !data ? (
        <LoadingState />
      ) : data.students.length === 0 ? (
        <EmptyState title={q ? 'Нема резултати' : 'Нема регистрирани студенти'}>
          {q && `Ниту еден студент не одговара на „${q}“.`}
        </EmptyState>
      ) : (
        <div className="panel overflow-hidden">
          <div
            className={`hidden border-b border-line bg-page/60 px-4 py-2 text-xs font-medium tracking-wide text-muted uppercase ${columns}`}
          >
            <span>Име</span>
            <span>Е-пошта</span>
            <span>Курсеви</span>
            <span>Регистриран</span>
            <span />
          </div>
          <ul className="divide-y divide-line text-sm">
            {data.students.map((s) => (
              <li key={s.id} className={`px-4 py-2.5 ${columns} sm:items-center`}>
                <span className="block truncate font-medium">{s.name}</span>
                <span className="block truncate text-muted">{s.email}</span>
                <span className="block text-muted sm:text-ink">
                  <span className="sm:hidden">Курсеви: </span>
                  {s.courseCount}
                </span>
                <span className="block text-muted">{formatDate(s.createdAt)}</span>
                <span className="mt-1 block sm:mt-0 sm:text-right">
                  <button type="button" className="link-danger" onClick={() => setToDelete(s)}>
                    Избриши
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Бришење на профил"
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
