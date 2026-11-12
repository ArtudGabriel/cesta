import { Test } from '@nestjs/testing';
import { PriceHistoryRepository } from './price-history.repository';
import { PriceHistoryService } from './price-history.service';

describe('PriceHistoryService', () => {
  let service: PriceHistoryService;
  let repoMock: { findSnapshotsByProduct: jest.Mock };

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
    repoMock = {
      findSnapshotsByProduct: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        PriceHistoryService,
        { provide: PriceHistoryRepository, useValue: repoMock },
      ],
    }).compile();

    service = module.get(PriceHistoryService);
  });

  it('agrupa pontos por supermercado preservando ordem cronológica', async () => {
    const d1 = new Date('2026-11-01T00:00:00Z');
    const d2 = new Date('2026-11-02T00:00:00Z');
    const sm1 = fakeSupermarket('s1', 'merc', 'Mercadona', '#009D58');
    const sm2 = fakeSupermarket('s2', 'lidl', 'LIDL', '#FFD100');

    repoMock.findSnapshotsByProduct.mockResolvedValue([
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
    repoMock.findSnapshotsByProduct.mockResolvedValue([]);
    await service.getSeries('p1', { days: 7, supermarketId: 's1' });

    expect(repoMock.findSnapshotsByProduct).toHaveBeenCalledWith(
      'p1',
      expect.any(Date),
      's1',
    );
  });

  it('usa janela correta de dias no filtro capturedAt', async () => {
    repoMock.findSnapshotsByProduct.mockResolvedValue([]);
    const before = Date.now();
    await service.getSeries('p1', { days: 60 });
    const after = Date.now();

    const fromArg = repoMock.findSnapshotsByProduct.mock.calls[0][1] as Date;
    const gte = fromArg.getTime();
    const windowMs = 60 * 24 * 60 * 60 * 1000;
    expect(gte).toBeGreaterThanOrEqual(before - windowMs - 5);
    expect(gte).toBeLessThanOrEqual(after - windowMs + 5);
  });

  it('retorna array vazio quando sem snapshots', async () => {
    repoMock.findSnapshotsByProduct.mockResolvedValue([]);
    const series = await service.getSeries('missing', { days: 30 });
    expect(series).toEqual([]);
  });
});
