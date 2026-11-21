'use client';

import type { ReactNode } from 'react';
import { CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';

export const inputClass =
  'w-full rounded-xl border border-white/10 bg-[#070a12] px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/15';

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-300 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/15 transition hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

export const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
        <p className="text-sm text-slate-400 mt-1">{description}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-white/[0.025] backdrop-blur-sm p-5 sm:p-6 ${className}`}
    >
      {children}
    </div>
  );
}

export function AlertBanner({
  notice,
  error,
  onClear,
}: {
  notice?: string;
  error?: string;
  onClear?: () => void;
}) {
  if (!notice && !error) return null;
  const isError = Boolean(error);
  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
        isError
          ? 'border-rose-500/35 bg-rose-500/10 text-rose-200'
          : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
      }`}
    >
      <div className="flex items-start gap-2.5">
        {isError ? (
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        )}
        <span>{error || notice}</span>
      </div>
      {onClear && (
        <button onClick={onClear} className="opacity-70 hover:opacity-100 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function LoadingPanel({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-16 text-sm font-mono text-slate-400">
      <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.015] py-12 px-6 text-center">
      <p className="text-sm font-semibold text-slate-200">{title}</p>
      <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
    </div>
  );
}
