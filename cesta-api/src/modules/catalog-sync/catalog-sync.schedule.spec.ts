import { FULL_SCHEDULE, activeSchedule } from './catalog-sync.schedule';

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
});
