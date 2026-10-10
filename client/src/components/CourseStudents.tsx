import { useState } from 'react';
import { api, errorMessage, useApi, useDebounced } from '../api';
import type { EnrolledStudent, StudentAccount } from '../types';
import { ConfirmDialog } from './ConfirmDialog';
import { Alert, ErrorState, LoadingState, Panel, SearchInput, Spinner } from './ui';

// Owner-only panel on the course page: enrolled students + enroll by search.
export function CourseStudents({ courseId, onChange }: { courseId: number; onChange: () => void }) {
  const enrolled = useApi<{ students: EnrolledStudent[] }>(`/courses/${courseId}/students`);
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim());
  const search = useApi<{ students: StudentAccount[] }>(
    q.length >= 2 ? `/students?q=${encodeURIComponent(q)}` : null,
  );
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<EnrolledStudent | null>(null);

  const enrolledIds = new Set(enrolled.data?.students.map((s) => s.id));
  const candidates = (search.data?.students ?? []).filter((s) => !enrolledIds.has(s.id)).slice(0, 8);

  function refresh() {
    enrolled.reload();
    onChange();
  }

  async function enroll(student: StudentAccount) {
    setBusyId(student.id);
    setActionError(null);
    try {
      await api(`/courses/${courseId}/students`, { method: 'POST', body: { userId: student.id } });
      refresh();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(student: EnrolledStudent) {
    await api(`/courses/${courseId}/students/${student.id}`, { method: 'DELETE' });
    setToRemove(null);
    refresh();
  }

  const count = enrolled.data ? ` (${enrolled.data.students.length})` : '';

  return (
    <Panel title={`Запишани студенти${count}`}>
      <div className="border-b border-line bg-page/50 px-4 py-3">
        <label className="label" htmlFor="enroll-search">
          Запиши студент
        </label>
        <SearchInput
          id="enroll-search"
          value={query}
          onChange={setQuery}
          placeholder="Име или е-пошта (најмалку 2 знаци)"
          label="Пребарај студент за запишување"
        />
        {actionError && (
          <div className="mt-2">
            <Alert>{actionError}</Alert>
          </div>
        )}
        {q.length >= 2 && (
          <div className="mt-2">
            {search.error ? (
              <p className="text-sm text-danger">{search.error.message}</p>
            ) : !search.data || search.loading ? (
              <p className="flex items-center gap-2 text-sm text-muted">
                <Spinner /> Се пребарува…
              </p>
            ) : candidates.length === 0 ? (
              <p className="text-sm text-muted">Нема незапишани студенти за „{q}“.</p>
            ) : (
              <ul className="divide-y divide-line rounded border border-line bg-white">
                {candidates.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0 text-sm">
                      <span className="font-medium">{s.name}</span>
                      <span className="ml-2 text-muted">{s.email}</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm shrink-0"
                      onClick={() => enroll(s)}
                      disabled={busyId !== null}
                    >
                      {busyId === s.id && <Spinner className="h-3 w-3" />}
                      Запиши
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {enrolled.error ? (
        <div className="p-4">
          <ErrorState message={enrolled.error.message} onRetry={enrolled.reload} />
        </div>
      ) : !enrolled.data ? (
        <LoadingState />
      ) : enrolled.data.students.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted">Нема запишани студенти.</p>
      ) : (
        <ul className="divide-y divide-line">
          {enrolled.data.students.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{s.name}</p>
                <p className="truncate text-muted">{s.email}</p>
              </div>
              <button type="button" className="link-danger shrink-0" onClick={() => setToRemove(s)}>
                Отпиши
              </button>
            </li>
          ))}
        </ul>
      )}

      {toRemove && (
        <ConfirmDialog
          title="Отпишување на студент"
          confirmLabel="Отпиши"
          onConfirm={() => remove(toRemove)}
          onClose={() => setToRemove(null)}
        >
          {toRemove.name} ({toRemove.email}) ќе биде отпишан од курсот. Профилот останува.
        </ConfirmDialog>
      )}
    </Panel>
  );
}
