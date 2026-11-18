import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  caption?: string;
}

/**
 * Sprint 107: card de métrica agregada. Payload é 100% agregado (sem PII) —
 * dispensa `data-sentry-mask`. Ver ADR-0007.
 */
export function MetricCard({ label, value, caption }: MetricCardProps) {
  return (
    <article className="rounded-2xl border border-ink/10 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-ink">{value}</p>
      {caption ? <p className="mt-1 text-xs text-muted">{caption}</p> : null}
    </article>
  );
}
