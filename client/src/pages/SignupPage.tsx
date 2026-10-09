import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, errorMessage } from '../api';
import { useAuth } from '../auth';
import { Alert, Field, Spinner } from '../components/ui';
import { AuthCard } from './AuthCard';

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await signup(name, email, password);
      navigate('/courses', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      if (err instanceof ApiError) setFields(err.fields);
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Регистрација"
      subtitle="Креирајте студентски профил за да ги следите курсевите."
      footer={
        <>
          Веќе имате профил?{' '}
          <Link to="/login" className="font-semibold text-teal-deep hover:underline">
            Најавете се
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field label="Име и презиме" htmlFor="name" error={fields.name}>
          <input
            id="name"
            className="input"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>
        <Field label="Е-пошта" htmlFor="email" error={fields.email}>
          <input
            id="email"
            type="email"
            className="input"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field
          label="Лозинка"
          htmlFor="password"
          error={fields.password}
          hint="Најмалку 8 знаци."
        >
          <input
            id="password"
            type="password"
            className="input"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy && <Spinner className="h-4 w-4" />}
          Креирај профил
        </button>
        <p className="text-xs text-ink-soft">
          Сите нови профили се студентски. Професорските профили ги креира администраторот.
        </p>
      </form>
    </AuthCard>
  );
}
