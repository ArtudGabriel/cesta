import * as Sentry from '@sentry/node';

function parseRate(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = parseFloat(raw);
  if (Number.isNaN(n) || n < 0 || n > 1) return fallback;
  return n;
}

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    // Sprint 60: release tracking — associa erros/perf ao commit SHA
    // (GitHub Actions popula via github.sha). Sem valor, Sentry omite.
    release: process.env.SENTRY_RELEASE,
    // Sprint 55: sample rate via env. Prod default 10%; dev local pode zerar.
    // SENTRY_PROFILES_SAMPLE_RATE documentado no .env.example mas não setado
    // aqui — @sentry/node exige `@sentry/profiling-node` integração dedicada
    // (plano pago); habilitar em sprint própria quando upgrade justificar.
    tracesSampleRate: parseRate(process.env.SENTRY_TRACES_SAMPLE_RATE, 0.1),
    // Sprint 59 GDPR: zero PII automático. sendDefaultPii default-false no
    // @sentry/node 11 (tipo não expõe mais); opt-in explícito via
    // `beforeSend` quando user identification for necessário.
  });
}

export { Sentry };
