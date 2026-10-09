import { useCallback, useEffect, useState } from 'react';

export const GENERIC_ERROR = 'Нешто тргна наопаку. Обидете се повторно.';
export const UNAUTHORIZED_EVENT = 'courseshub:unauthorized';

export class ApiError extends Error {
  status: number;
  fields: Record<string, string>;

  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export async function api<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const hasBody = options.body !== undefined;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
      body: hasBody ? JSON.stringify(options.body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(0, 'Нема врска со серверот. Проверете ја врската и обидете се повторно.');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // Session expired or account removed: let the auth context log out.
    if (res.status === 401 && !path.startsWith('/auth/')) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(res.status, data?.error ?? GENERIC_ERROR, data?.fields ?? {});
  }
  return data as T;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : GENERIC_ERROR;
}

type ApiState<T> = { data?: T; error?: ApiError; loading: boolean };

// GET a path and track loading/error. Keeps the previous data while
// reloading so lists don't flash on every search keystroke.
export function useApi<T>(path: string | null) {
  const [state, setState] = useState<ApiState<T>>({ loading: path !== null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (path === null) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    api<T>(path)
      .then((data) => !cancelled && setState({ data, loading: false }))
      .catch((err) => {
        if (cancelled) return;
        const error = err instanceof ApiError ? err : new ApiError(0, GENERIC_ERROR);
        setState({ error, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [path, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}

export function useDebounced<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('mk-MK', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(value),
  );
}
