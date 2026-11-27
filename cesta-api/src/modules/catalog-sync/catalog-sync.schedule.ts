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
