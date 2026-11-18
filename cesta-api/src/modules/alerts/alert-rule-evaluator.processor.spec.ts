import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Job, Queue } from 'bullmq';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ALERT_RULE_EVAL_QUEUE,
  AlertRuleEvalJob,
  AlertRuleEvaluatorProcessor,
} from './alert-rule-evaluator.processor';
import { AlertsRepository } from './alerts.repository';

/**
 * Sprint 105 — evaluator cron 2h. Testa cada tipo (combo/trend/bundle) +
 * idempotência (lastNotifiedHash) + skip de payload inválido.
 */
describe('AlertRuleEvaluatorProcessor', () => {
  let processor: AlertRuleEvaluatorProcessor;
  let repo: {
    findAllActiveRules: jest.Mock;
    markRuleNotified: jest.Mock;
  };
  let prisma: {
    productPrice: { findMany: jest.Mock };
    priceSnapshot: { aggregate: jest.Mock };
  };
  let notifications: { sendToUser: jest.Mock };
  let queue: { add: jest.Mock };
  let config: ConfigService;

  const now = new Date('2026-11-18T12:00:00Z');

  function job(name = 'rule-eval-scan'): Job<AlertRuleEvalJob> {
    return { name, data: {} as AlertRuleEvalJob } as Job<AlertRuleEvalJob>;
  }

  function rule(
    type: 'combo' | 'trend' | 'bundle',
    rulesPayload: unknown,
    overrides: Partial<Record<string, unknown>> = {},
  ) {
    return {
      id: `r-${type}`,
      userId: 'u1',
      type,
      rules: rulesPayload as Prisma.JsonValue,
      isActive: true,
      lastNotifiedAt: null,
      lastNotifiedHash: null,
      lastTriggeredAt: null,
      ...overrides,
    } as never;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);

    repo = {
      findAllActiveRules: jest.fn(),
      markRuleNotified: jest.fn().mockResolvedValue(undefined),
    };
    prisma = {
      productPrice: { findMany: jest.fn() },
      priceSnapshot: { aggregate: jest.fn() },
    };
    notifications = {
      sendToUser: jest.fn().mockResolvedValue({ sent: 1, removed: 0 }),
    };
    queue = { add: jest.fn().mockResolvedValue(undefined) };
    config = {
      get: jest.fn((_key: string, fallback?: unknown) => fallback),
    } as unknown as ConfigService;

    processor = new AlertRuleEvaluatorProcessor(
      repo as unknown as AlertsRepository,
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
      config,
      queue as unknown as Queue<AlertRuleEvalJob>,
    );
    jest.spyOn(processor['logger'], 'log').mockImplementation(() => undefined);
    jest.spyOn(processor['logger'], 'warn').mockImplementation(() => undefined);
    jest
      .spyOn(processor['logger'], 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
  });

  const cuid = (n: number) => `c${String(n).padStart(24, '0').slice(0, 24)}`;
  const P1 = cuid(1);
  const P2 = cuid(2);
  const P3 = cuid(3);

  it('combo: soma dos menores preços <= target → dispara push + marca hash', async () => {
    repo.findAllActiveRules.mockResolvedValue([
      rule('combo', { productIds: [P1, P2], targetTotal: 5 }),
    ]);
    prisma.productPrice.findMany.mockResolvedValue([
      { productId: P1, supermarketId: 'm1', currentPrice: new Prisma.Decimal('2.00') },
      { productId: P1, supermarketId: 'm2', currentPrice: new Prisma.Decimal('1.50') },
      { productId: P2, supermarketId: 'm1', currentPrice: new Prisma.Decimal('3.00') },
    ]);

    await processor.process(job());

    expect(notifications.sendToUser).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ tag: 'alert-rule-r-combo' }),
    );
    expect(repo.markRuleNotified).toHaveBeenCalledWith(
      'r-combo',
      expect.any(String),
      now,
    );
  });

  it('combo: soma acima do target → não dispara', async () => {
    repo.findAllActiveRules.mockResolvedValue([
      rule('combo', { productIds: [P1, P2], targetTotal: 3 }),
    ]);
    prisma.productPrice.findMany.mockResolvedValue([
      { productId: P1, supermarketId: 'm1', currentPrice: new Prisma.Decimal('2.00') },
      { productId: P2, supermarketId: 'm1', currentPrice: new Prisma.Decimal('2.00') },
    ]);

    await processor.process(job());

    expect(notifications.sendToUser).not.toHaveBeenCalled();
    expect(repo.markRuleNotified).not.toHaveBeenCalled();
  });

  it('trend: 2 semanas consecutivas de queda → dispara', async () => {
    repo.findAllActiveRules.mockResolvedValue([
      rule('trend', { productId: P1, consecutiveWeeks: 2 }),
    ]);
    // 3 janelas (weeks + 1): recent=1.0, mid=1.5, oldest=2.0 → queda strict
    prisma.priceSnapshot.aggregate
      .mockResolvedValueOnce({ _min: { price: new Prisma.Decimal('1.00') } })
      .mockResolvedValueOnce({ _min: { price: new Prisma.Decimal('1.50') } })
      .mockResolvedValueOnce({ _min: { price: new Prisma.Decimal('2.00') } });

    await processor.process(job());

    expect(notifications.sendToUser).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ tag: 'alert-rule-r-trend' }),
    );
  });

  it('trend: sem queda monotônica → não dispara', async () => {
    repo.findAllActiveRules.mockResolvedValue([
      rule('trend', { productId: P1, consecutiveWeeks: 2 }),
    ]);
    prisma.priceSnapshot.aggregate
      .mockResolvedValueOnce({ _min: { price: new Prisma.Decimal('1.50') } })
      .mockResolvedValueOnce({ _min: { price: new Prisma.Decimal('1.00') } }) // subiu
      .mockResolvedValueOnce({ _min: { price: new Prisma.Decimal('2.00') } });

    await processor.process(job());

    expect(notifications.sendToUser).not.toHaveBeenCalled();
  });

  it('bundle: savings >= target entre mercados → dispara', async () => {
    repo.findAllActiveRules.mockResolvedValue([
      rule('bundle', { productIds: [P1, P2], targetSavings: 2 }),
    ]);
    prisma.productPrice.findMany.mockResolvedValue([
      // m1 total = 10
      { productId: P1, supermarketId: 'm1', currentPrice: new Prisma.Decimal('5.00') },
      { productId: P2, supermarketId: 'm1', currentPrice: new Prisma.Decimal('5.00') },
      // m2 total = 7
      { productId: P1, supermarketId: 'm2', currentPrice: new Prisma.Decimal('3.00') },
      { productId: P2, supermarketId: 'm2', currentPrice: new Prisma.Decimal('4.00') },
    ]);

    await processor.process(job());

    expect(notifications.sendToUser).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ tag: 'alert-rule-r-bundle' }),
    );
  });

  it('idempotência: mesmo hash de estado → skip', async () => {
    // Primeiro run: calcula e marca hash
    repo.findAllActiveRules.mockResolvedValueOnce([
      rule('combo', { productIds: [P1, P2], targetTotal: 5 }),
    ]);
    prisma.productPrice.findMany.mockResolvedValueOnce([
      { productId: P1, supermarketId: 'm1', currentPrice: new Prisma.Decimal('2.00') },
      { productId: P2, supermarketId: 'm1', currentPrice: new Prisma.Decimal('2.50') },
    ]);
    await processor.process(job());
    const hash = repo.markRuleNotified.mock.calls[0]?.[1];
    expect(hash).toBeDefined();
    repo.markRuleNotified.mockClear();
    notifications.sendToUser.mockClear();

    // Segundo run: mesmo estado → hash match → skip
    repo.findAllActiveRules.mockResolvedValueOnce([
      rule(
        'combo',
        { productIds: [P1, P2], targetTotal: 5 },
        { lastNotifiedHash: hash },
      ),
    ]);
    prisma.productPrice.findMany.mockResolvedValueOnce([
      { productId: P1, supermarketId: 'm1', currentPrice: new Prisma.Decimal('2.00') },
      { productId: P2, supermarketId: 'm1', currentPrice: new Prisma.Decimal('2.50') },
    ]);
    await processor.process(job());

    expect(notifications.sendToUser).not.toHaveBeenCalled();
    expect(repo.markRuleNotified).not.toHaveBeenCalled();
  });

  it('payload inválido (shape errado) → skip + log warn, não crash', async () => {
    repo.findAllActiveRules.mockResolvedValue([
      rule('combo', { productIds: ['not-a-cuid'], targetTotal: -1 }),
    ]);

    await expect(processor.process(job())).resolves.toBeUndefined();
    expect(notifications.sendToUser).not.toHaveBeenCalled();
  });

  it('ignora jobs com nome diferente de rule-eval-scan', async () => {
    await processor.process(job('other'));
    expect(repo.findAllActiveRules).not.toHaveBeenCalled();
  });

  it('expõe queue name canônico', () => {
    expect(ALERT_RULE_EVAL_QUEUE).toBe('alert-rule-evaluator');
  });
});
