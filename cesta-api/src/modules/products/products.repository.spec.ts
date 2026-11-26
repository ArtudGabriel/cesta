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

  // Sprint 185 — rerank determinístico (S182 P3 nit: lecge→Lechuga top1 Leche #2).
  // O boost3 "short direct-typo" (LEFT(first_word,3)=LEFT(q,3) + |len diff|<=1)
  // + tiebreak char_length ASC + alfabético é SQL-side; esses specs cobrem o
  // contrato acima dele (preservação da ordem retornada pelo raw).
  it('fuzzy fallback S185: honra ordem raw com 3 candidatos (lecge→Leche top sobre Lechuga)', async () => {
    prisma.product.findMany
      .mockResolvedValueOnce([]) // ILIKE zero
      .mockResolvedValueOnce([
        {
          id: 'p-lechuga',
          name: 'Lechuga iceberg 500g',
          brand: null,
          imageUrl: null,
          prices: [],
        },
        {
          id: 'p-leche',
          name: 'Leche entera 1L',
          brand: null,
          imageUrl: null,
          prices: [],
        },
        {
          id: 'p-lechon',
          name: 'Lechón asado',
          brand: null,
          imageUrl: null,
          prices: [],
        },
      ]);
    // Raw ORDER BY (score + boosts) DESC, char_length ASC, name ASC:
    // - Leche (len 5, diff 0) boost3 fires + word_sim boost2 fires → top
    // - Lechón (len 6, diff 1) boost3 fires mas word_sim first_word ~0.3 → #2
    // - Lechuga (len 7, diff 2) boost3 NÃO fires → #3
    prisma.$queryRaw.mockResolvedValueOnce([
      { id: 'p-leche' },
      { id: 'p-lechon' },
      { id: 'p-lechuga' },
    ]);

    const res = await repo.findSuggestions('lecge', 8);
    expect(res.map((r) => r.id)).toEqual(['p-leche', 'p-lechon', 'p-lechuga']);
  });
});
