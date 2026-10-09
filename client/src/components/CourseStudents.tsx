import { useState } from 'react';
import { api, errorMessage, useApi, useDebounced } from '../api';
import type { EnrolledStudent, StudentAccount } from '../types';
import { ConfirmDialog } from './ConfirmDialog';
import { Alert, ErrorState, LoadingState, SearchInput, Spinner } from './ui';

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

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-xl font-bold">
        Запишани студенти
        {enrolled.data && (
          <span className="ml-2 font-sans text-base font-medium text-ink-soft">
            ({enrolled.data.students.length})
          </span>
        )}
      </h2>

      <div className="mt-4 rounded-md bg-paper p-4">
        <p className="label">Запиши студент</p>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Пребарај по име или е-пошта…"
          label="Пребарај студент за запишување"
        />
        {actionError && (
          <div className="mt-3">
            <Alert>{actionError}</Alert>
          </div>
        )}
        {q.length >= 2 && (
          <div className="mt-3">
            {search.error ? (
              <p className="text-sm text-danger">{search.error.message}</p>
            ) : !search.data || search.loading ? (
              <p className="flex items-center gap-2 text-sm text-ink-soft">
                <Spinner className="h-4 w-4" /> Се пребарува…
              </p>
            ) : candidates.length === 0 ? (
              <p className="text-sm text-ink-soft">Нема незапишани студенти што одговараат на „{q}“.</p>
            ) : (
              <ul className="divide-y divide-ink/10 rounded-md border border-ink/10 bg-white">
                {candidates.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.name}</p>
                      <p className="truncate text-xs text-ink-soft">{s.email}</p>
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

      <div className="mt-5">
        {enrolled.error ? (
          <ErrorState message={enrolled.error.message} onRetry={enrolled.reload} />
        ) : !enrolled.data ? (
          <LoadingState />
        ) : enrolled.data.students.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-soft">
            Сè уште нема запишани студенти. Пребарајте студент погоре.
          </p>
        ) : (
          <ul className="divide-y divide-ink/10">
            {enrolled.data.students.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="truncate text-sm text-ink-soft">{s.email}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost-danger btn-sm shrink-0"
                  onClick={() => setToRemove(s)}
                >
                  Отпиши
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {toRemove && (
        <ConfirmDialog
          title="Отпиши студент?"
          confirmLabel="Отпиши"
          onConfirm={() => remove(toRemove)}
          onClose={() => setToRemove(null)}
        >
          {toRemove.name} ({toRemove.email}) ќе биде отпишан од курсот. Профилот останува.
        </ConfirmDialog>
      )}
    </section>
  );
}
