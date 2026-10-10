import type { ReactNode } from 'react';

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-sm pt-2 sm:pt-8">
      <div className="panel px-5 py-6 sm:px-6">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
        <div className="mt-5">{children}</div>
      </div>
      <p className="mt-4 text-center text-sm text-muted">{footer}</p>
    </div>
  );
}
