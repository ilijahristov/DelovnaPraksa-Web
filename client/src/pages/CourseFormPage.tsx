import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, errorMessage, useApi } from '../api';
import { Alert, EmptyState, ErrorState, Field, LoadingState, PageHeader, Spinner } from '../components/ui';
import type { CourseDetail, CourseSummary } from '../types';

// Create (/courses/new) and edit (/courses/:id/edit).
export function CourseFormPage() {
  const { id } = useParams();
  const isEdit = id !== undefined;
  const navigate = useNavigate();
  const existing = useApi<{ course: CourseDetail }>(isEdit ? `/courses/${id}` : null);

  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const loaded = existing.data?.course;
  useEffect(() => {
    if (!loaded) return;
    setCode(loaded.code);
    setTitle(loaded.title);
    setDescription(loaded.description);
  }, [loaded]);

  if (isEdit) {
    if (existing.error) return <ErrorState message={existing.error.message} onRetry={existing.reload} />;
    if (!loaded) return <LoadingState />;
    if (!loaded.isOwner) {
      return (
        <EmptyState title="Немате пристап">Можете да уредувате само курсеви што ги водите.</EmptyState>
      );
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const body = { code, title, description };
      const res = isEdit
        ? await api<{ course: CourseSummary }>(`/courses/${id}`, { method: 'PATCH', body })
        : await api<{ course: CourseSummary }>('/courses', { method: 'POST', body });
      navigate(`/courses/${res.course.id}`);
    } catch (err) {
      setError(errorMessage(err));
      if (err instanceof ApiError) setFields(err.fields);
      setBusy(false);
    }
  }

  const cancelTo = isEdit ? `/courses/${id}` : '/my-courses';

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={isEdit ? 'Уреди курс' : 'Нов курс'}
        subtitle={isEdit ? loaded?.code : 'Внесете ги основните податоци за курсот.'}
      />
      <form onSubmit={onSubmit} className="card space-y-5 p-5 sm:p-6" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field
          label="Код"
          htmlFor="code"
          error={fields.code}
          hint="Латинични букви, бројки и цртичка, пр. WEB101."
        >
          <input
            id="code"
            className="input font-mono uppercase"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={20}
            required
          />
        </Field>
        <Field label="Наслов" htmlFor="title" error={fields.title}>
          <input
            id="title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={150}
            required
          />
        </Field>
        <Field
          label="Опис"
          htmlFor="description"
          error={fields.description}
          hint={`${description.length}/2000 знаци`}
        >
          <textarea
            id="description"
            className="input min-h-36"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
          />
        </Field>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link to={cancelTo} className="btn btn-secondary">
            Откажи
          </Link>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy && <Spinner className="h-4 w-4" />}
            {isEdit ? 'Зачувај промени' : 'Креирај курс'}
          </button>
        </div>
      </form>
    </div>
  );
}
