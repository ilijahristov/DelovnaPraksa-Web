import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { errorMessage } from '../api';
import { Alert, Spinner } from './ui';

type Props = {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
};

// Rendered only while open. Stays open and shows the error if onConfirm fails.
export function ConfirmDialog({ title, children, confirmLabel, onConfirm, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[15vh]"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md rounded-md bg-white shadow-lg"
      >
        <div className="border-b border-line px-5 py-3">
          <h2 id="confirm-title" className="text-base font-semibold">
            {title}
          </h2>
        </div>
        <div className="space-y-3 px-5 py-4 text-sm">
          <div>{children}</div>
          {error && <Alert>{error}</Alert>}
        </div>
        <div className="flex justify-end gap-2 border-t border-line bg-page/60 px-5 py-3">
          <button
            ref={cancelRef}
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={busy}
          >
            Откажи
          </button>
          <button type="button" className="btn btn-danger" onClick={confirm} disabled={busy}>
            {busy && <Spinner />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
