// Sprint 225 (ADR 0033) — schedule extraído do processor pra permitir unit
// test sem carregar @nestjs/bullmq (ESM, falha jest sob pnpm node_modules
// resolution local; CI npm ci transforma OK via transformIgnorePatterns).

export const FULL_SCHEDULE: ReadonlyArray<{ slug: string; cron: string }> = [
  { slug: 'mercadona', cron: '0 3 * * *' },
  { slug: 'dia', cron: '30 4 * * *' },
  { slug: 'eroski', cron: '0 5 * * *' },
  { slug: 'froiz', cron: '0 6 * * 2' },
  // S225 ADR 0033: LIDL + Aldi daily pra destravar path ADR 0032 sourceImageUrl.
  { slug: 'lidl', cron: '0 6 * * *' },
  { slug: 'aldi', cron: '0 7 * * *' },
];

export const RETIRED_SLUGS: ReadonlyArray<string> = ['carrefour', 'alcampo'];

export function activeSchedule(): ReadonlyArray<{ slug: string; cron: string }> {
  return FULL_SCHEDULE;
}

/**
 * Sprint 241 (#6 badge DESACTUALIZADO):
 *
 * BullMQ default `attempts: 1` fazia qualquer falha transiente do adapter
 * (403 anti-bot, CDN timeout, Render spin-down) deixar o run fail-sem-retry
 * até o próximo cron (24h depois pros diários, 7d pro Froiz). Resultado:
 * ProductPrice.lastSyncedAt congelado, badge DESACTUALIZADO disparado
 * mesmo sendo problema transiente de 1 ciclo.
 *
 * Retry policy: 3 tentativas, exponential backoff (5min → 10min → 20min).
 * Max 35min de janela de retry, folgado dentro do intervalo de qualquer
 * cron atual (menor = daily = 24h). Permite recuperação de transiente
 * dentro do mesmo "dia lógico" do schedule.
 */
export const SCHEDULED_CRON_RETRY_ATTEMPTS = 3;
export const SCHEDULED_CRON_RETRY_BACKOFF_MS = 5 * 60 * 1000;

export const SCHEDULED_CRON_JOB_OPTIONS = {
  attempts: SCHEDULED_CRON_RETRY_ATTEMPTS,
  backoff: {
    type: 'exponential' as const,
    delay: SCHEDULED_CRON_RETRY_BACKOFF_MS,
  },
  removeOnComplete: 50,
  removeOnFail: 50,
} as const;
