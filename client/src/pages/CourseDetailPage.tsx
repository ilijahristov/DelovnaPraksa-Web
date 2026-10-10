import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, errorMessage, formatDate, useApi } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CourseStudents } from '../components/CourseStudents';
import { Alert, EmptyState, ErrorState, Field, LoadingState, PageHeader, Panel, Spinner } from '../components/ui';
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
        <PageHeader title="Курс" crumbs={[{ label: 'Курсеви', to: '/courses' }]} />
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
      <PageHeader
        title={course.title}
        subtitle={`${course.code} · ${course.owner.name}`}
        crumbs={[{ label: 'Курсеви', to: '/courses' }, { label: course.code }]}
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="space-y-5">
          <Panel title="Опис">
            <div className="px-4 py-3 text-sm leading-relaxed">
              {course.description ? (
                <p className="whitespace-pre-line">{course.description}</p>
              ) : (
                <p className="text-muted">Нема опис.</p>
              )}
            </div>
          </Panel>

          <Panel title={`Материјали (${course.materials.length})`}>
            {course.materials.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">Нема додадени материјали.</p>
            ) : (
              <ul className="divide-y divide-line">
                {course.materials.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-sm font-medium text-brand hover:underline"
                      >
                        {m.title}
                      </a>
                      <span className="block truncate text-xs text-muted">
                        {hostname(m.url)} · додадено {formatDate(m.createdAt)}
                      </span>
                    </div>
                    {course.isOwner && (
                      <button
                        type="button"
                        className="link-danger shrink-0"
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
          </Panel>

          {course.isOwner && <CourseStudents courseId={course.id} onChange={reload} />}
        </div>

        <aside className="space-y-5">
          <Panel title="За курсот">
            <dl className="divide-y divide-line text-sm">
              <InfoRow label="Код">
                <span className="font-mono">{course.code}</span>
              </InfoRow>
              <InfoRow label="Професор">{course.owner.name}</InfoRow>
              <InfoRow label="Запишани">{course.enrolledCount}</InfoRow>
              <InfoRow label="Креиран">{formatDate(course.createdAt)}</InfoRow>
              {course.isEnrolled && (
                <InfoRow label="Статус">
                  <span className="font-medium text-brand">Запишани сте</span>
                </InfoRow>
              )}
            </dl>
            {course.isOwner && (
              <div className="flex gap-2 border-t border-line px-4 py-3">
                <Link to={`/courses/${course.id}/edit`} className="btn btn-secondary flex-1">
                  Уреди
                </Link>
                <button
                  type="button"
                  className="btn btn-secondary flex-1 text-danger"
                  onClick={() => setConfirmDelete(true)}
                >
                  Избриши
                </button>
              </div>
            )}
          </Panel>
        </aside>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Бришење на курс"
          confirmLabel="Избриши курс"
          onConfirm={deleteCourse}
          onClose={() => setConfirmDelete(false)}
        >
          Курсот <strong>{course.code}</strong> заедно со сите материјали и запишувања ќе биде
          трајно избришан.
        </ConfirmDialog>
      )}
      {materialToRemove && (
        <ConfirmDialog
          title="Отстранување на материјал"
          confirmLabel="Отстрани"
          onConfirm={() => removeMaterial(materialToRemove)}
          onClose={() => setMaterialToRemove(null)}
        >
          Дали сакате да го отстраните „{materialToRemove.title}“?
        </ConfirmDialog>
      )}
    </>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 px-4 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
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
    <form onSubmit={onSubmit} className="border-t border-line bg-page/50 px-4 py-3" noValidate>
      <p className="mb-2 text-sm font-medium">Нов материјал</p>
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
            placeholder="https://"
          />
        </Field>
        <button type="submit" className="btn btn-primary sm:mt-6" disabled={busy}>
          {busy && <Spinner />}
          Додај
        </button>
      </div>
    </form>
  );
}
