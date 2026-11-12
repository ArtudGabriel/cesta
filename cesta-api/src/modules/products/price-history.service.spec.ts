import { Test } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { PriceHistoryService } from './price-history.service';

describe('PriceHistoryService', () => {
  let service: PriceHistoryService;
  let prismaMock: { priceSnapshot: { findMany: jest.Mock } };

  const fakeSupermarket = (
    id: string,
    slug: string,
    name: string,
    color: string | null,
  ) => ({
    id,
    slug,
    name,
    color,
    logoUrl: null,
    website: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const fakeSnapshot = (
    overrides: Partial<{
      productId: string;
      supermarketId: string;
      price: number;
      onPromotion: boolean;
      capturedAt: Date;
      supermarket: ReturnType<typeof fakeSupermarket>;
    }>,
  ) => ({
    id: 'snap-' + Math.random(),
    productId: 'p1',
    supermarketId: 's1',
    price: { toString: () => String(overrides.price ?? 1) } as unknown as number,
    onPromotion: overrides.onPromotion ?? false,
    source: 'seed',
    capturedAt: overrides.capturedAt ?? new Date(),
    supermarket:
      overrides.supermarket ?? fakeSupermarket('s1', 'merc', 'Mercadona', '#009D58'),
    ...overrides,
  });

  beforeEach(async () => {
    prismaMock = {
      priceSnapshot: { findMany: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        PriceHistoryService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(PriceHistoryService);
  });

  it('agrupa pontos por supermercado preservando ordem cronológica', async () => {
    const d1 = new Date('2026-11-01T00:00:00Z');
    const d2 = new Date('2026-11-02T00:00:00Z');
    const sm1 = fakeSupermarket('s1', 'merc', 'Mercadona', '#009D58');
    const sm2 = fakeSupermarket('s2', 'lidl', 'LIDL', '#FFD100');

    prismaMock.priceSnapshot.findMany.mockResolvedValue([
      fakeSnapshot({ productId: 'p1', supermarketId: 's1', price: 1.5, capturedAt: d1, supermarket: sm1 }),
      fakeSnapshot({ productId: 'p1', supermarketId: 's2', price: 1.4, capturedAt: d1, supermarket: sm2 }),
      fakeSnapshot({ productId: 'p1', supermarketId: 's1', price: 1.6, capturedAt: d2, supermarket: sm1 }),
      fakeSnapshot({ productId: 'p1', supermarketId: 's2', price: 1.45, capturedAt: d2, onPromotion: true, supermarket: sm2 }),
    ]);

    const series = await service.getSeries('p1', { days: 30 });

    expect(series).toHaveLength(2);
    const merc = series.find((s) => s.supermarketSlug === 'merc')!;
    const lidl = series.find((s) => s.supermarketSlug === 'lidl')!;
    expect(merc.points).toEqual([
      { date: d1.toISOString(), price: 1.5, onPromotion: false },
      { date: d2.toISOString(), price: 1.6, onPromotion: false },
    ]);
    expect(lidl.points).toEqual([
      { date: d1.toISOString(), price: 1.4, onPromotion: false },
      { date: d2.toISOString(), price: 1.45, onPromotion: true },
    ]);
  });

  it('filtra por supermarketId quando informado', async () => {
    prismaMock.priceSnapshot.findMany.mockResolvedValue([]);
    await service.getSeries('p1', { days: 7, supermarketId: 's1' });

    const call = prismaMock.priceSnapshot.findMany.mock.calls[0][0];
    expect(call.where).toMatchObject({ productId: 'p1', supermarketId: 's1' });
    expect(call.where.capturedAt).toHaveProperty('gte');
  });

  it('usa janela correta de dias no filtro capturedAt', async () => {
    prismaMock.priceSnapshot.findMany.mockResolvedValue([]);
    const before = Date.now();
    await service.getSeries('p1', { days: 60 });
    const after = Date.now();

    const call = prismaMock.priceSnapshot.findMany.mock.calls[0][0];
    const gte = (call.where.capturedAt as { gte: Date }).gte.getTime();
    const windowMs = 60 * 24 * 60 * 60 * 1000;
    expect(gte).toBeGreaterThanOrEqual(before - windowMs - 5);
    expect(gte).toBeLessThanOrEqual(after - windowMs + 5);
  });

  it('retorna array vazio quando sem snapshots', async () => {
    prismaMock.priceSnapshot.findMany.mockResolvedValue([]);
    const series = await service.getSeries('missing', { days: 30 });
    expect(series).toEqual([]);
  });
});
