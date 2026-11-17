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
  ALERT_PRICE_CHECK_QUEUE,
  AlertPriceCheckJob,
  AlertPriceCheckProcessor,
} from './alert-price-check.processor';
import { AlertsRepository } from './alerts.repository';

type RepoMock = {
  findAllActive: jest.Mock;
  createTrigger: jest.Mock;
  markTriggered: jest.Mock;
  markNotified: jest.Mock;
  markAlertNotified: jest.Mock;
};

type PrismaMock = {
  productPrice: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
  };
};

/**
 * Sprint 96: cron alert-price-check — avalia reason por tipo, idempotência
 * por lastNotifiedPrice, mark de lastNotifiedAt/Price e chamada ao notifier.
 */
describe('AlertPriceCheckProcessor', () => {
  let processor: AlertPriceCheckProcessor;
  let repo: RepoMock;
  let prisma: PrismaMock;
  let notifications: { sendToUser: jest.Mock };
  let queue: { add: jest.Mock };
  let config: ConfigService;

  const now = new Date('2026-11-17T12:00:00Z');

  function job(name = 'price-check-scan'): Job<AlertPriceCheckJob> {
    return { name, data: {} as AlertPriceCheckJob } as Job<AlertPriceCheckJob>;
  }

  function alertRow(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'a1',
      userId: 'u1',
      productId: 'p1',
      supermarketId: 's1',
      type: 'target_price',
      targetPrice: new Prisma.Decimal('1.50'),
      isActive: true,
      lastNotifiedAt: null,
      lastNotifiedPrice: null,
      ...overrides,
    } as never;
  }

  function priceRow(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      productId: 'p1',
      supermarketId: 's1',
      currentPrice: new Prisma.Decimal('1.40'),
      previousPrice: new Prisma.Decimal('1.60'),
      onPromotion: false,
      isAvailable: true,
      product: { id: 'p1', name: 'Leche' },
      supermarket: { id: 's1', slug: 'mercadona', name: 'Mercadona' },
      ...overrides,
    } as never;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);

    repo = {
      findAllActive: jest.fn(),
      createTrigger: jest.fn().mockResolvedValue({ id: 't1' }),
      markTriggered: jest.fn().mockResolvedValue(undefined),
      markNotified: jest.fn().mockResolvedValue(undefined),
      markAlertNotified: jest.fn().mockResolvedValue(undefined),
    };
    prisma = {
      productPrice: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    notifications = {
      sendToUser: jest.fn().mockResolvedValue({ sent: 1, removed: 0 }),
    };
    queue = { add: jest.fn().mockResolvedValue(undefined) };
    config = {
      get: jest.fn((_key: string, fallback?: unknown) => fallback),
    } as unknown as ConfigService;

    processor = new AlertPriceCheckProcessor(
      repo as unknown as AlertsRepository,
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
      config,
      queue as unknown as Queue<AlertPriceCheckJob>,
    );
    jest.spyOn(processor['logger'], 'log').mockImplementation(() => undefined);
    jest.spyOn(processor['logger'], 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
  });

  it('target_price <= target → dispara push e marca lastNotifiedAt/Price', async () => {
    repo.findAllActive.mockResolvedValue([alertRow()]);
    prisma.productPrice.findUnique.mockResolvedValue(priceRow());

    await processor.process(job());

    expect(notifications.sendToUser).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        tag: 'alert-a1',
        data: expect.objectContaining({ url: '/produto/p1' }),
      }),
    );
    expect(repo.markAlertNotified).toHaveBeenCalledWith(
      'a1',
      expect.any(Prisma.Decimal),
      now,
    );
    expect(repo.markNotified).toHaveBeenCalledWith('t1');
  });

  it('idempotente: skip quando currentPrice == lastNotifiedPrice', async () => {
    repo.findAllActive.mockResolvedValue([
      alertRow({ lastNotifiedPrice: new Prisma.Decimal('1.40') }),
    ]);
    prisma.productPrice.findUnique.mockResolvedValue(priceRow());

    await processor.process(job());

    expect(notifications.sendToUser).not.toHaveBeenCalled();
    expect(repo.createTrigger).not.toHaveBeenCalled();
    expect(repo.markAlertNotified).not.toHaveBeenCalled();
  });

  it('target_price acima do target → não dispara', async () => {
    repo.findAllActive.mockResolvedValue([alertRow()]);
    prisma.productPrice.findUnique.mockResolvedValue(
      priceRow({ currentPrice: new Prisma.Decimal('1.80') }),
    );

    await processor.process(job());

    expect(notifications.sendToUser).not.toHaveBeenCalled();
    expect(repo.markAlertNotified).not.toHaveBeenCalled();
  });

  it('alerta sem supermarket usa o menor preço disponível (findFirst)', async () => {
    repo.findAllActive.mockResolvedValue([
      alertRow({ supermarketId: null }),
    ]);
    prisma.productPrice.findFirst.mockResolvedValue(priceRow());

    await processor.process(job());

    expect(prisma.productPrice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId: 'p1', isAvailable: true },
        orderBy: { currentPrice: 'asc' },
      }),
    );
    expect(notifications.sendToUser).toHaveBeenCalled();
  });

  it('ignora jobs com nome diferente de price-check-scan', async () => {
    await processor.process(job('other-name'));
    expect(repo.findAllActive).not.toHaveBeenCalled();
  });

  it('expõe queue name canônico', () => {
    expect(ALERT_PRICE_CHECK_QUEUE).toBe('alert-price-check');
  });
});
