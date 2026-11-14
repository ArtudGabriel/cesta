import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

function parseRate(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = parseFloat(raw);
  if (Number.isNaN(n) || n < 0 || n > 1) return fallback;
  return n;
}

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    // Sprint 60: release tracking — Vercel/CI popula via NEXT_PUBLIC_SENTRY_RELEASE
    // (github.sha). Sem valor Sentry omite.
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    // Sprint 55: sample rate via env (prod default 10%, dev local pode zerar).
    tracesSampleRate: parseRate(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
      0.1,
    ),
    // Sprint 58: Session Replay — grava interação pra reproduzir bugs.
    // Sprint 59 (GDPR Espanha): maskAllText flip pra true — secure-by-default.
    // Elementos chrome i18n públicos ganham [data-sentry-unmask]; PII sensível
    // (Art. 9 saúde, gastos, user profile) ganha [data-sentry-mask] explícito
    // defense-in-depth.
    replaysSessionSampleRate: parseRate(
      process.env.NEXT_PUBLIC_SENTRY_REPLAY_SAMPLE_RATE,
      0.05,
    ),
    replaysOnErrorSampleRate: parseRate(
      process.env.NEXT_PUBLIC_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE,
      1.0,
    ),
    // sendDefaultPii é false por default no @sentry/nextjs 11 (removido do
     // tipo público). Mantém zero PII automático; para incluir, usar
     // beforeSend/beforeBreadcrumb opt-in.
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
        mask: ["[data-sentry-mask]"],
        unmask: ["[data-sentry-unmask]"],
      }),
    ],
  });
}
