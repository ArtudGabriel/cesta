import {
  FULL_SCHEDULE,
  SCHEDULED_CRON_JOB_OPTIONS,
  SCHEDULED_CRON_RETRY_ATTEMPTS,
  SCHEDULED_CRON_RETRY_BACKOFF_MS,
  activeSchedule,
} from './catalog-sync.schedule';

describe('catalog-sync schedule (Sprint 225 ADR 0033)', () => {
  it('LIDL + Aldi usam cron diário (destrava path ADR 0032 sourceImageUrl)', () => {
    const lidl = FULL_SCHEDULE.find((e) => e.slug === 'lidl');
    const aldi = FULL_SCHEDULE.find((e) => e.slug === 'aldi');
    expect(lidl?.cron).toBe('0 6 * * *');
    expect(aldi?.cron).toBe('0 7 * * *');
  });

  it('Froiz mantém cron semanal (terça) — fora escopo S225', () => {
    const froiz = FULL_SCHEDULE.find((e) => e.slug === 'froiz');
    expect(froiz?.cron).toBe('0 6 * * 2');
  });

  it('Mercadona + DIA + Eroski permanecem diários', () => {
    expect(FULL_SCHEDULE.find((e) => e.slug === 'mercadona')?.cron).toBe('0 3 * * *');
    expect(FULL_SCHEDULE.find((e) => e.slug === 'dia')?.cron).toBe('30 4 * * *');
    expect(FULL_SCHEDULE.find((e) => e.slug === 'eroski')?.cron).toBe('0 5 * * *');
  });

  it('activeSchedule devolve FULL_SCHEDULE', () => {
    expect(activeSchedule()).toBe(FULL_SCHEDULE);
  });

  it('slugs aposentados (Carrefour, Alcampo) não aparecem no schedule', () => {
    const slugs = FULL_SCHEDULE.map((e) => e.slug);
    expect(slugs).not.toContain('carrefour');
    expect(slugs).not.toContain('alcampo');
  });

  describe('Sprint 241 #6: retry policy pra scheduled cron jobs', () => {
    it('attempts = 3 (default BullMQ 1 → falha transiente garantia 24h stale)', () => {
      expect(SCHEDULED_CRON_RETRY_ATTEMPTS).toBe(3);
      expect(SCHEDULED_CRON_JOB_OPTIONS.attempts).toBe(3);
    });

    it('backoff exponential 5min → 10min → 20min (max 35min, dentro do ciclo diário)', () => {
      expect(SCHEDULED_CRON_RETRY_BACKOFF_MS).toBe(5 * 60 * 1000);
      expect(SCHEDULED_CRON_JOB_OPTIONS.backoff.type).toBe('exponential');
      expect(SCHEDULED_CRON_JOB_OPTIONS.backoff.delay).toBe(5 * 60 * 1000);
      // Soma 5 + 10 + 20 = 35min; menor cron (diário) = 1440min → folga 40x.
      const totalBackoffMs =
        SCHEDULED_CRON_RETRY_BACKOFF_MS * (1 + 2 + 4);
      expect(totalBackoffMs).toBeLessThan(60 * 60 * 1000); // < 1h
    });

    it('removeOnComplete/Fail preservados (caps mantidos)', () => {
      expect(SCHEDULED_CRON_JOB_OPTIONS.removeOnComplete).toBe(50);
      expect(SCHEDULED_CRON_JOB_OPTIONS.removeOnFail).toBe(50);
    });
  });
});
