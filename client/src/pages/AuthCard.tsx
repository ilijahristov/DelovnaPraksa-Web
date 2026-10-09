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
    <div className="mx-auto max-w-md pt-4 sm:pt-10">
      <div className="card overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-amber via-teal-light to-teal-deep" />
        <div className="p-6 sm:p-8">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
      <p className="mt-4 text-center text-sm text-ink-soft">{footer}</p>
    </div>
  );
}
