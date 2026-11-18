import { Test } from '@nestjs/testing';
import { AdminMetricsRepository } from './admin-metrics.repository';
import { AdminMetricsService } from './admin-metrics.service';

type RepoMock = {
  [K in keyof AdminMetricsRepository]: jest.Mock;
};

function buildRepoMock(): RepoMock {
  return {
    countUsersActive: jest.fn(),
    countDistinctActiveUsersSince: jest.fn(),
    countSimpleAlertsActive: jest.fn(),
    countAlertRulesByType: jest.fn(),
    countReceiptsByStatusSince: jest.fn(),
    countAlertsNotifiedSince: jest.fn(),
    countAlertRulesNotifiedSince: jest.fn(),
    countFamilyBasketsReadySince: jest.fn(),
  };
}

async function buildService(
  repo: RepoMock,
  envTtl?: string,
): Promise<AdminMetricsService> {
  const prev = process.env.METRICS_CACHE_TTL_MS;
  if (envTtl === undefined) {
    delete process.env.METRICS_CACHE_TTL_MS;
  } else {
    process.env.METRICS_CACHE_TTL_MS = envTtl;
  }
  const module = await Test.createTestingModule({
    providers: [
      AdminMetricsService,
      { provide: AdminMetricsRepository, useValue: repo },
    ],
  }).compile();
  const svc = module.get(AdminMetricsService);
  if (prev === undefined) {
    delete process.env.METRICS_CACHE_TTL_MS;
  } else {
    process.env.METRICS_CACHE_TTL_MS = prev;
  }
  return svc;
}

function primeRepo(repo: RepoMock): void {
  repo.countUsersActive.mockResolvedValue(100);
  repo.countDistinctActiveUsersSince.mockResolvedValue(42);
  repo.countSimpleAlertsActive.mockResolvedValue(7);
  repo.countAlertRulesByType.mockResolvedValue([
    { type: 'combo', count: 3 },
    { type: 'trend', count: 5 },
    { type: 'bundle', count: 2 },
  ]);
  repo.countReceiptsByStatusSince.mockImplementation(async (status: string) =>
    status === 'ready' ? 120 : 8,
  );
  repo.countAlertsNotifiedSince.mockResolvedValue(15);
  repo.countAlertRulesNotifiedSince.mockResolvedValue(6);
  repo.countFamilyBasketsReadySince.mockResolvedValue(9);
}

describe('AdminMetricsService (Sprint 107)', () => {
  it('agrega simple + combo/trend/bundle em alertsActiveByType e soma pushNotifications7d', async () => {
    const repo = buildRepoMock();
    primeRepo(repo);
    const svc = await buildService(repo);

    const snap = await svc.getSnapshot(new Date('2026-11-18T12:00:00Z'));

    expect(snap.usersTotal).toBe(100);
    expect(snap.usersActive7d).toBe(42);
    expect(snap.alertsActiveByType).toEqual({
      simple: 7,
      combo: 3,
      trend: 5,
      bundle: 2,
    });
    expect(snap.receipts30d).toEqual({ parsed: 120, failed: 8 });
    expect(snap.pushNotifications7d).toBe(21); // 15 + 6
    expect(snap.familyBasketsGenerated7d).toBe(9);
    expect(snap.cached).toBe(false);
    expect(snap.generatedAt).toBe('2026-11-18T12:00:00.000Z');
  });

  it('segunda chamada dentro do TTL retorna cached=true com generatedAt idêntico e NÃO re-chama repo', async () => {
    const repo = buildRepoMock();
    primeRepo(repo);
    const svc = await buildService(repo);

    const t0 = new Date('2026-11-18T12:00:00Z');
    const first = await svc.getSnapshot(t0);
    expect(first.cached).toBe(false);

    const t1 = new Date(t0.getTime() + 60_000); // +1min
    const second = await svc.getSnapshot(t1);
    expect(second.cached).toBe(true);
    expect(second.generatedAt).toBe(first.generatedAt);
    expect(repo.countUsersActive).toHaveBeenCalledTimes(1);
  });

  it('após TTL (>5min default) refaz agregação com generatedAt novo', async () => {
    const repo = buildRepoMock();
    primeRepo(repo);
    const svc = await buildService(repo);

    const t0 = new Date('2026-11-18T12:00:00Z');
    const first = await svc.getSnapshot(t0);

    repo.countUsersActive.mockResolvedValue(101); // número mudou
    const t1 = new Date(t0.getTime() + 6 * 60_000); // +6min > 5min TTL
    const second = await svc.getSnapshot(t1);

    expect(second.cached).toBe(false);
    expect(second.generatedAt).not.toBe(first.generatedAt);
    expect(second.usersTotal).toBe(101);
    expect(repo.countUsersActive).toHaveBeenCalledTimes(2);
  });

  it('ignora rule.type desconhecido sem quebrar (future-proof contra novos tipos)', async () => {
    const repo = buildRepoMock();
    primeRepo(repo);
    repo.countAlertRulesByType.mockResolvedValue([
      { type: 'combo', count: 3 },
      { type: 'future_type_xyz', count: 99 },
    ]);
    const svc = await buildService(repo);

    const snap = await svc.getSnapshot(new Date('2026-11-18T12:00:00Z'));

    expect(snap.alertsActiveByType).toEqual({
      simple: 7,
      combo: 3,
      trend: 0,
      bundle: 0,
    });
  });
});
