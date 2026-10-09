import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, errorMessage, useApi } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CourseStudents } from '../components/CourseStudents';
import { Alert, CodeChip, EmptyState, ErrorState, Field, LoadingState, Spinner } from '../components/ui';
import type { CourseDetail, Material } from '../types';

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function CourseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, error, reload } = useApi<{ course: CourseDetail }>(`/courses/${id}`);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [materialToRemove, setMaterialToRemove] = useState<Material | null>(null);

  if (error) {
    return (
      <>
        <BackLink />
        {error.status === 404 ? (
          <EmptyState title="Курсот не е пронајден">
            Курсот можеби е избришан или линкот е погрешен.
          </EmptyState>
        ) : (
          <ErrorState message={error.message} onRetry={reload} />
        )}
      </>
    );
  }
  if (!data) return <LoadingState />;

  const { course } = data;

  async function deleteCourse() {
    await api(`/courses/${course.id}`, { method: 'DELETE' });
    navigate('/my-courses', { replace: true });
  }

  async function removeMaterial(material: Material) {
    await api(`/courses/${course.id}/materials/${material.id}`, { method: 'DELETE' });
    setMaterialToRemove(null);
    reload();
  }

  return (
    <>
      <BackLink />

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CodeChip code={course.code} />
            {course.isOwner && (
              <span className="rounded bg-teal-deep/10 px-2 py-0.5 text-xs font-semibold text-teal-deep">
                Ваш курс
              </span>
            )}
            {course.isEnrolled && (
              <span className="rounded bg-teal-deep/10 px-2 py-0.5 text-xs font-semibold text-teal-deep">
                Запишани сте
              </span>
            )}
          </div>
          <h1 className="mt-2 text-3xl font-bold break-words">{course.title}</h1>
          <p className="mt-1 text-ink-soft">
            Професор: <span className="font-medium text-ink">{course.owner.name}</span>
            {course.isOwner && <> · {course.enrolledCount} запишани</>}
          </p>
        </div>
        {course.isOwner && (
          <div className="flex gap-2">
            <Link to={`/courses/${course.id}/edit`} className="btn btn-secondary">
              Уреди
            </Link>
            <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
              Избриши
            </button>
          </div>
        )}
      </header>

      <div className="space-y-6">
        <section className="card p-5 sm:p-6">
          <h2 className="text-xl font-bold">Опис</h2>
          {course.description ? (
            <p className="mt-3 whitespace-pre-line text-ink/90">{course.description}</p>
          ) : (
            <p className="mt-3 text-sm text-ink-soft">Нема опис за овој курс.</p>
          )}
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="text-xl font-bold">
            Материјали
            <span className="ml-2 font-sans text-base font-medium text-ink-soft">
              ({course.materials.length})
            </span>
          </h2>
          {course.materials.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-soft">
              {course.isOwner
                ? 'Сè уште нема материјали. Додадете го првиот линк подолу.'
                : 'Професорот сè уште нема додадено материјали.'}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-ink/10">
              {course.materials.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex min-w-0 items-center gap-3"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-soft text-ink">
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M8 12l4-4M7 6l1-1a3.5 3.5 0 015 5l-1 1M13 14l-1 1a3.5 3.5 0 01-5-5l1-1" strokeLinecap="round" />
                      </svg>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-teal-deep group-hover:underline">
                        {m.title}
                      </span>
                      <span className="block truncate text-xs text-ink-soft">{hostname(m.url)} ↗</span>
                    </span>
                  </a>
                  {course.isOwner && (
                    <button
                      type="button"
                      className="btn btn-ghost-danger btn-sm shrink-0"
                      onClick={() => setMaterialToRemove(m)}
                    >
                      Отстрани
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {course.isOwner && <AddMaterialForm courseId={course.id} onAdded={reload} />}
        </section>

        {course.isOwner && <CourseStudents courseId={course.id} onChange={reload} />}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Избриши го курсот?"
          confirmLabel="Избриши курс"
          onConfirm={deleteCourse}
          onClose={() => setConfirmDelete(false)}
        >
          Курсот <strong>{course.code}</strong>, сите негови материјали и запишувања ќе бидат
          трајно избришани.
        </ConfirmDialog>
      )}
      {materialToRemove && (
        <ConfirmDialog
          title="Отстрани материјал?"
          confirmLabel="Отстрани"
          onConfirm={() => removeMaterial(materialToRemove)}
          onClose={() => setMaterialToRemove(null)}
        >
          „{materialToRemove.title}“ ќе биде отстранет од курсот.
        </ConfirmDialog>
      )}
    </>
  );
}

function BackLink() {
  return (
    <Link to="/courses" className="mb-4 inline-block text-sm font-medium text-teal-deep hover:underline">
      ← Сите курсеви
    </Link>
  );
}

function AddMaterialForm({ courseId, onAdded }: { courseId: number; onAdded: () => void }) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await api(`/courses/${courseId}/materials`, { method: 'POST', body: { title, url } });
      setTitle('');
      setUrl('');
      onAdded();
    } catch (err) {
      setError(errorMessage(err));
      if (err instanceof ApiError) setFields(err.fields);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 rounded-md bg-paper p-4" noValidate>
      <p className="mb-3 text-sm font-semibold">Додај материјал (линк)</p>
      {error && (
        <div className="mb-3">
          <Alert>{error}</Alert>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-start">
        <Field label="Наслов" htmlFor="material-title" error={fields.title}>
          <input
            id="material-title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="пр. Предавање 1"
          />
        </Field>
        <Field label="Линк (URL)" htmlFor="material-url" error={fields.url}>
          <input
            id="material-url"
            type="url"
            className="input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
          />
        </Field>
        <button type="submit" className="btn btn-primary sm:mt-6" disabled={busy}>
          {busy && <Spinner className="h-4 w-4" />}
          Додај
        </button>
      </div>
    </form>
  );
}
