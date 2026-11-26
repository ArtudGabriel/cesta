/**
 * Sprint 180 — regression findSuggestions fuzzy fallback pg_trgm.
 *
 * ADR 0012: ILIKE primeiro (hot path sem typo). Zero matches + q>=3 → fallback
 * raw $queryRaw com similarity() > 0.3 + GIN idx_product_name_trgm +
 * idx_product_brand_trgm. Preserva ordem similarity DESC do raw.
 */
import { ProductsRepository } from './products.repository';
import type { PrismaService } from '../../database/prisma.service';

describe('ProductsRepository.findSuggestions (Sprint 180 fuzzy fallback)', () => {
  let repo: ProductsRepository;
  let prisma: {
    product: {
      findMany: jest.Mock;
    };
    $queryRaw: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      product: { findMany: jest.fn() },
      $queryRaw: jest.fn(),
    };
    repo = new ProductsRepository(prisma as unknown as PrismaService);
  });

  it('ILIKE path: rows > 0 → retorna scored normal, NÃO chama $queryRaw', async () => {
    prisma.product.findMany.mockResolvedValueOnce([
      {
        id: 'p1',
        name: 'Leche entera 1L',
        brand: 'Hacendado',
        imageUrl: null,
        prices: [],
      },
    ]);
    const res = await repo.findSuggestions('leche', 8);
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe('p1');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('fuzzy fallback: rows=[] + q>=3 → $queryRaw trigram + segundo ORM query', async () => {
    prisma.product.findMany
      .mockResolvedValueOnce([]) // ILIKE zero matches
      .mockResolvedValueOnce([
        // Segundo query shape completo
        {
          id: 'p-leche',
          name: 'Leche entera 1L',
          brand: null,
          imageUrl: null,
          prices: [],
        },
      ]);
    prisma.$queryRaw.mockResolvedValueOnce([{ id: 'p-leche' }]);

    const res = await repo.findSuggestions('lecge', 8);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe('p-leche');
  });

  it('fuzzy fallback: q<3 char NÃO dispara $queryRaw (ILIKE vazio fica vazio)', async () => {
    prisma.product.findMany.mockResolvedValueOnce([]);
    const res = await repo.findSuggestions('ab', 8);
    expect(res).toEqual([]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('fuzzy fallback: $queryRaw retorna [] → retorna [] sem erro', async () => {
    prisma.product.findMany.mockResolvedValueOnce([]);
    prisma.$queryRaw.mockResolvedValueOnce([]);
    const res = await repo.findSuggestions('xyz987', 8);
    expect(res).toEqual([]);
  });

  it('fuzzy fallback: preserva ordem similarity DESC do raw', async () => {
    prisma.product.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'p-b', name: 'Yogur B', brand: null, imageUrl: null, prices: [] },
        { id: 'p-a', name: 'Yogur A', brand: null, imageUrl: null, prices: [] },
      ]);
    // Raw retorna A primeiro (similarity maior)
    prisma.$queryRaw.mockResolvedValueOnce([{ id: 'p-a' }, { id: 'p-b' }]);
    const res = await repo.findSuggestions('yogrt', 8);
    // Ordem preservada do raw: A primeiro
    expect(res.map((r) => r.id)).toEqual(['p-a', 'p-b']);
  });
});
