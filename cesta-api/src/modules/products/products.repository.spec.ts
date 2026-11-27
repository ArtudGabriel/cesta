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
  // Sprint 187 (nit S185 P3 a): spec valida SQL contract que compõe o rerank
  // (não só pass-through da ordem retornada). Quebra se S188+ remover/renomear
  // boost CASE, tiebreak columns ou cap LEAST.
  it('fuzzy fallback S187: SQL rerank inclui 3 boosts + LEAST cap + tiebreak', async () => {
    prisma.product.findMany
      .mockResolvedValueOnce([]) // ILIKE zero
      .mockResolvedValueOnce([
        { id: 'p1', name: 'Leche entera 1L', brand: null, imageUrl: null, prices: [] },
      ]);
    prisma.$queryRaw.mockResolvedValueOnce([{ id: 'p1' }]);

    await repo.findSuggestions('lecge', 8);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const [strings] = prisma.$queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    const sql = Array.from(strings).join(' ');

    // Baseline fuzzy: word_similarity em name + brand, threshold 0.3
    expect(sql).toMatch(/word_similarity\(/);
    expect(sql).toMatch(/> 0\.3/);
    expect(sql).toMatch(/GREATEST\(/);

    // Boost (a) prefix exact: LOWER LIKE '%' prefix + regex boundary
    expect(sql).toMatch(/LOWER\("name"\) LIKE LOWER\(/);

    // Boost (b) first-word word_similarity >= 0.5
    expect(sql).toMatch(/SPLIT_PART\("name", ' ', 1\)/);
    expect(sql).toMatch(/>= 0\.5/);

    // Boost (c) S185 short direct-typo: LEFT(first_word,3) + ABS len diff <=1
    expect(sql).toMatch(/LEFT\(LOWER\(SPLIT_PART/);
    expect(sql).toMatch(/ABS\(char_length\(SPLIT_PART/);
    expect(sql).toMatch(/<= 1/);

    // Boost cap S187: LEAST(..., 1.0) envolvendo soma dos 3 boosts
    expect(sql).toMatch(/\+ LEAST\(/);
    expect(sql).toMatch(/, 1\.0\)/);

    // Tiebreak S185: char_length ASC, name ASC
    expect(sql).toMatch(/char_length\("name"\) ASC/);
    expect(sql).toMatch(/"name" ASC/);

    // DESC score + LIMIT bound
    expect(sql).toMatch(/\) DESC,/);
    expect(sql).toMatch(/LIMIT/);
  });

  // Sprint 187 (nit S185 P3 a cont.): valida interpolação de valores no raw tag.
  // Mock recebe (strings, ...values) — garante query q entra como param + take.
  it('fuzzy fallback S187: $queryRaw recebe q + take como interpolações', async () => {
    prisma.product.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'p1', name: 'Leche entera 1L', brand: null, imageUrl: null, prices: [] },
      ]);
    prisma.$queryRaw.mockResolvedValueOnce([{ id: 'p1' }]);

    await repo.findSuggestions('lecge', 5);

    const call = prisma.$queryRaw.mock.calls[0];
    const values = (call as unknown[]).slice(1);
    // q aparece 6x no SQL (where name, where brand, GREATEST name, GREATEST brand,
    // LIKE boost, word_sim boost (b), LEFT boost (c) etc.); take 1x. Checa presença.
    expect(values).toContain('lecge');
    // take = min(limit*2, 40) pra sampling ampliado antes do rerank client-side
    expect(values).toContain(10);
  });

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

// ────────────────────────────────────────────────────────────────────
// Sprint 228 #7 — multi-token tokenize AND-of-OR em findSuggestions +
// findForSearch. Bug user: busca "coca zero" retornava vazio porque
// single ILIKE '%coca zero%' não achava "Coca-Cola Zero Azucar 2L"
// (hyphen + "Cola " entre). Tokenize + AND resolve sem pg_trgm.
// ────────────────────────────────────────────────────────────────────

describe('ProductsRepository multi-token tokenize (Sprint 228 #7)', () => {
  let repo: ProductsRepository;
  let prisma: {
    product: {
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
    };
    category: { findFirst: jest.Mock };
    $queryRaw: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      product: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
      },
      category: { findFirst: jest.fn() },
      $queryRaw: jest.fn(),
    };
    repo = new ProductsRepository(prisma as unknown as PrismaService);
  });

  it('findSuggestions "coca zero": tokenize → AND com 2 tokens; cada token OR(name,brand)', async () => {
    prisma.product.findMany.mockResolvedValueOnce([
      {
        id: 'p-coca',
        name: 'Coca-Cola Zero Azucar 2L',
        brand: 'Coca-Cola',
        imageUrl: null,
        prices: [],
      },
    ]);
    const res = await repo.findSuggestions('coca zero', 8);
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe('p-coca');
    // Verifica shape do where passado pro Prisma:
    const call = prisma.product.findMany.mock.calls[0][0];
    expect(call.where.AND).toHaveLength(2);
    expect(call.where.AND[0].OR).toEqual([
      { name: { contains: 'coca', mode: 'insensitive' } },
      { brand: { contains: 'coca', mode: 'insensitive' } },
    ]);
    expect(call.where.AND[1].OR).toEqual([
      { name: { contains: 'zero', mode: 'insensitive' } },
      { brand: { contains: 'zero', mode: 'insensitive' } },
    ]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('findSuggestions "coca": single-token → legado OR(name,brand) preservado', async () => {
    prisma.product.findMany.mockResolvedValueOnce([
      {
        id: 'p-coca',
        name: 'Coca-Cola 2L',
        brand: 'Coca-Cola',
        imageUrl: null,
        prices: [],
      },
    ]);
    await repo.findSuggestions('coca', 8);
    const call = prisma.product.findMany.mock.calls[0][0];
    expect(call.where.OR).toEqual([
      { name: { contains: 'coca', mode: 'insensitive' } },
      { brand: { contains: 'coca', mode: 'insensitive' } },
    ]);
    expect(call.where.AND).toBeUndefined();
  });

  it('findSuggestions "  coca   zero  milka  ": trim + split por whitespace múltiplos tokens', async () => {
    prisma.product.findMany.mockResolvedValueOnce([]);
    prisma.$queryRaw.mockResolvedValueOnce([]);
    await repo.findSuggestions('  coca   zero  milka  ', 8);
    const call = prisma.product.findMany.mock.calls[0][0];
    expect(call.where.AND).toHaveLength(3);
    expect(call.where.AND[0].OR[0]).toEqual({
      name: { contains: 'coca', mode: 'insensitive' },
    });
    expect(call.where.AND[1].OR[0]).toEqual({
      name: { contains: 'zero', mode: 'insensitive' },
    });
    expect(call.where.AND[2].OR[0]).toEqual({
      name: { contains: 'milka', mode: 'insensitive' },
    });
  });

  it('findForSearch "coca zero": mesma tokenização aplicada', async () => {
    prisma.product.findMany.mockResolvedValueOnce([
      {
        id: 'p-coca',
        name: 'Coca-Cola Zero Azucar 2L',
        imageUrl: null,
        prices: [{ currentPrice: 1.89 }],
      },
    ]);
    prisma.product.count.mockResolvedValueOnce(1);
    const res = await repo.findForSearch('coca zero', 10);
    expect(res.items).toHaveLength(1);
    expect(res.items[0].id).toBe('p-coca');
    expect(res.total).toBe(1);
    const call = prisma.product.findMany.mock.calls[0][0];
    expect(call.where.AND).toHaveLength(2);
    expect(call.where.deletedAt).toBeNull();
  });

  it('findSuggestions "": query vazia → match-nothing guard (sem explodir)', async () => {
    prisma.product.findMany.mockResolvedValueOnce([]);
    const res = await repo.findSuggestions('', 8);
    expect(res).toEqual([]);
    const call = prisma.product.findMany.mock.calls[0][0];
    expect(call.where.id).toBe('__none__');
  });

  describe('Sprint 243b: exclui produto sem price ativo (public endpoints)', () => {
    it('findForSearch: where carrega prices.some { isAvailable, deletedAt null }', async () => {
      prisma.product.findMany.mockResolvedValueOnce([]);
      prisma.product.count.mockResolvedValueOnce(0);
      await repo.findForSearch('leche', 10);
      const call = prisma.product.findMany.mock.calls[0][0];
      expect(call.where.prices).toEqual({
        some: { isAvailable: true, deletedAt: null },
      });
    });

    it('findSuggestions: where carrega prices.some { isAvailable, deletedAt null }', async () => {
      // ILIKE primeiro path (rows > 0) — evita cair no trgm raw query.
      prisma.product.findMany.mockResolvedValueOnce([
        {
          id: 'p1',
          name: 'Leche entera 1L',
          brand: 'Hacendado',
          imageUrl: null,
          prices: [],
        },
      ]);
      await repo.findSuggestions('leche', 8);
      const call = prisma.product.findMany.mock.calls[0][0];
      expect(call.where.prices).toEqual({
        some: { isAvailable: true, deletedAt: null },
      });
    });

    it('findMany sem filtros adicionais: where.prices.some { isAvailable, deletedAt null }', async () => {
      prisma.product.findMany.mockResolvedValueOnce([]);
      prisma.product.count.mockResolvedValueOnce(0);
      await repo.findMany({
        skip: 0,
        limit: 20,
        page: 1,
      } as any);
      const call = prisma.product.findMany.mock.calls[0][0];
      expect(call.where.prices).toEqual({
        some: { isAvailable: true, deletedAt: null },
      });
    });

    it('findMany com supermarket filter: aperta prices.some (adiciona supermarket.slug sem relaxar isAvailable/deletedAt)', async () => {
      prisma.product.findMany.mockResolvedValueOnce([]);
      prisma.product.count.mockResolvedValueOnce(0);
      await repo.findMany({
        skip: 0,
        limit: 20,
        page: 1,
        supermarket: 'mercadona',
      } as any);
      const call = prisma.product.findMany.mock.calls[0][0];
      expect(call.where.prices).toEqual({
        some: {
          isAvailable: true,
          deletedAt: null,
          supermarket: { slug: 'mercadona' },
        },
      });
    });

    it('findMany com onPromotion: aperta prices.some mantendo deletedAt=null', async () => {
      prisma.product.findMany.mockResolvedValueOnce([]);
      prisma.product.count.mockResolvedValueOnce(0);
      await repo.findMany({
        skip: 0,
        limit: 20,
        page: 1,
        onPromotion: true,
      } as any);
      const call = prisma.product.findMany.mock.calls[0][0];
      expect(call.where.prices.some.isAvailable).toBe(true);
      expect(call.where.prices.some.deletedAt).toBeNull();
      expect(call.where.prices.some.onPromotion).toBe(true);
    });

    it('findById / findManyByIds: NÃO exige price ativo (preserva comportamento debug/admin)', async () => {
      prisma.product.findFirst.mockResolvedValueOnce(null);
      await repo.findById('p-admin');
      const firstCall = prisma.product.findFirst.mock.calls[0][0];
      expect(firstCall.where.prices).toBeUndefined();

      prisma.product.findMany.mockResolvedValueOnce([]);
      await repo.findManyByIds(['p-admin']);
      const manyCall = prisma.product.findMany.mock.calls[0][0];
      expect(manyCall.where.prices).toBeUndefined();
    });
  });
});
