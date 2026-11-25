import { Test } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { ProductsRepository } from './products.repository';

describe('ProductsService.suggest', () => {
  let service: ProductsService;
  let repoMock: { findSuggestions: jest.Mock; findForSearch: jest.Mock };

  const fakeSupermarket = (slug: string, name: string) => ({
    id: slug,
    slug,
    name,
    color: null,
    logoUrl: null,
    website: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(async () => {
    repoMock = { findSuggestions: jest.fn(), findForSearch: jest.fn() } as any;
    const module = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: ProductsRepository, useValue: repoMock },
      ],
    }).compile();
    service = module.get(ProductsService);
  });

  it('retorna sugestoes com cheapestPrice mapeado', async () => {
    repoMock.findSuggestions.mockResolvedValue([
      {
        id: 'p1',
        name: 'Aceite oliva',
        brand: 'Carbonell',
        imageUrl: null,
        prices: [
          {
            currentPrice: { toString: () => '3.15' } as unknown as number,
            supermarket: fakeSupermarket('merc', 'Mercadona'),
          },
        ],
      },
    ]);

    const result = await service.suggest('ace', 8);
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]).toEqual({
      id: 'p1',
      name: 'Aceite oliva',
      brand: 'Carbonell',
      imageUrl: null,
      cheapestPrice: {
        value: 3.15,
        supermarketSlug: 'merc',
        supermarketName: 'Mercadona',
      },
    });
    expect(repoMock.findSuggestions).toHaveBeenCalledWith('ace', 8);
  });

  it('cheapestPrice null quando produto sem preco disponivel', async () => {
    repoMock.findSuggestions.mockResolvedValue([
      {
        id: 'p1',
        name: 'Produto raro',
        brand: null,
        imageUrl: null,
        prices: [],
      },
    ]);

    const result = await service.suggest('rar', 8);
    expect(result.suggestions[0].cheapestPrice).toBeNull();
  });

  it('array vazio quando repo retorna vazio', async () => {
    repoMock.findSuggestions.mockResolvedValue([]);
    const result = await service.suggest('xzzz', 8);
    expect(result.suggestions).toEqual([]);
  });

  it('trim na query antes de passar pro repo', async () => {
    repoMock.findSuggestions.mockResolvedValue([]);
    await service.suggest('  ace  ', 5);
    expect(repoMock.findSuggestions).toHaveBeenCalledWith('ace', 5);
  });
});

describe('ProductsService.search (S106)', () => {
  let service: ProductsService;
  let repoMock: { findSuggestions: jest.Mock; findForSearch: jest.Mock };

  beforeEach(async () => {
    repoMock = { findSuggestions: jest.fn(), findForSearch: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: ProductsRepository, useValue: repoMock },
      ],
    }).compile();
    service = module.get(ProductsService);
  });

  it('retorna items + total do repo sem transformar shape', async () => {
    repoMock.findForSearch.mockResolvedValue({
      items: [
        { id: 'c1', name: 'Leche entera', imageUrl: null, cheapestUnitPrice: 0.95 },
        { id: 'c2', name: 'Leche desnatada', imageUrl: 'https://cdn/img.jpg', cheapestUnitPrice: 1.1 },
      ],
      total: 42,
    });

    const result = await service.search({ q: 'leche', limit: 10 });
    expect(result.total).toBe(42);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual({
      id: 'c1',
      name: 'Leche entera',
      imageUrl: null,
      cheapestUnitPrice: 0.95,
    });
    expect(repoMock.findForSearch).toHaveBeenCalledWith('leche', 10);
  });

  it('propaga cheapestUnitPrice null (produto sem oferta ativa)', async () => {
    repoMock.findForSearch.mockResolvedValue({
      items: [
        { id: 'c9', name: 'Producto raro', imageUrl: null, cheapestUnitPrice: null },
      ],
      total: 1,
    });

    const result = await service.search({ q: 'raro', limit: 10 });
    expect(result.items[0].cheapestUnitPrice).toBeNull();
    expect(result.total).toBe(1);
  });
});

// Sprint 131: compare multi-super matrix
describe('ProductsService.compare', () => {
  let service: ProductsService;
  let repoMock: { findManyByIds: jest.Mock };

  beforeEach(async () => {
    repoMock = { findManyByIds: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: ProductsRepository, useValue: repoMock as unknown },
      ],
    }).compile();
    service = module.get(ProductsService);
  });

  it('retorna produtos mapeados para ids válidos', async () => {
    repoMock.findManyByIds.mockResolvedValue([
      { id: 'p1', name: 'Leche 1L', prices: [] },
      { id: 'p2', name: 'Leche 6x1L', prices: [] },
    ]);
    const result = await service.compare(['p1', 'p2']);
    expect(result).toHaveLength(2);
    expect(repoMock.findManyByIds).toHaveBeenCalledWith(['p1', 'p2']);
  });

  it('rejeita lista vazia com COMPARE_EMPTY', async () => {
    await expect(service.compare([])).rejects.toMatchObject({
      message: expect.stringContaining('ao menos 1 id'),
    });
  });

  it('rejeita > 20 ids com COMPARE_LIMIT_EXCEEDED', async () => {
    const ids = Array.from({ length: 21 }, (_, i) => `p${i}`);
    await expect(service.compare(ids)).rejects.toMatchObject({
      message: expect.stringContaining('Máximo 20'),
    });
  });
});

// Sprint 132: featured deals (spread ordering)
describe('ProductsService.featuredDeals', () => {
  let service: ProductsService;
  let repoMock: { findManyWithPrices: jest.Mock };

  const makeEntity = (
    id: string,
    prices: Array<{
      slug: string;
      price: number;
      available?: boolean;
      previousPrice?: number | null;
      onPromotion?: boolean;
    }>,
  ) => ({
    id,
    name: `Prod ${id}`,
    brand: null,
    normalizedName: `prod-${id}`,
    ean: null,
    imageUrl: null,
    categoryId: null,
    packageSize: 1,
    packageUnit: 'LITER',
    comparisonUnit: 'LITER',
    calories: null,
    protein: null,
    fat: null,
    saturatedFat: null,
    carbs: null,
    sugar: null,
    salt: null,
    fiber: null,
    nutritionPer: null,
    nutriScore: null,
    isVegan: false,
    isVegetarian: false,
    isGlutenFree: false,
    isLactoseFree: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    prices: prices.map((pr) => ({
      id: `price-${id}-${pr.slug}`,
      productId: id,
      supermarketId: pr.slug,
      currentPrice: pr.price,
      previousPrice: pr.previousPrice ?? null,
      onPromotion: pr.onPromotion ?? false,
      isAvailable: pr.available !== false,
      isStale: false,
      lastSyncedAt: new Date(),
      confidenceScore: 1,
      source: 'official_api',
      createdAt: new Date(),
      updatedAt: new Date(),
      supermarket: {
        id: pr.slug,
        slug: pr.slug,
        name: pr.slug.toUpperCase(),
        color: null,
        logoUrl: null,
        website: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })),
  });

  beforeEach(async () => {
    repoMock = { findManyWithPrices: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: ProductsRepository, useValue: repoMock as unknown },
      ],
    }).compile();
    service = module.get(ProductsService);
  });

  it('ordena produtos por spread DESC + cap limit', async () => {
    repoMock.findManyWithPrices.mockResolvedValue([
      makeEntity('spread-small', [
        { slug: 'merc', price: 1.0 },
        { slug: 'dia', price: 1.2 },
      ]),
      makeEntity('spread-big', [
        { slug: 'merc', price: 1.0 },
        { slug: 'aldi', price: 3.5 },
      ]),
      makeEntity('spread-mid', [
        { slug: 'merc', price: 1.0 },
        { slug: 'lidl', price: 2.0 },
      ]),
    ] as never);

    const result = await service.featuredDeals(2);
    expect(result.map((p) => p.id)).toEqual(['spread-big', 'spread-mid']);
  });

  it('Sprint 155: solo supermercado SEM previousPrice fica fora; solo COM promo entra', async () => {
    repoMock.findManyWithPrices.mockResolvedValue([
      // solo sem previousPrice → savings=0 → fora
      makeEntity('solo-no-promo', [{ slug: 'merc', price: 1.0 }]),
      // solo com previousPrice > currentPrice → savings=0.5 → entra
      makeEntity('solo-with-promo', [
        { slug: 'merc', price: 1.0, previousPrice: 1.5, onPromotion: true },
      ]),
      // duo cross-market spread → savings=1.0 → entra, score maior
      makeEntity('duo', [
        { slug: 'merc', price: 1.0 },
        { slug: 'dia', price: 2.0 },
      ]),
    ] as never);

    const result = await service.featuredDeals(10);
    const ids = result.map((p) => p.id);
    expect(ids).toContain('duo');
    expect(ids).toContain('solo-with-promo');
    expect(ids).not.toContain('solo-no-promo');
    // duo (1.0 spread) ranqueia antes de solo-with-promo (0.5 saving)
    expect(ids.indexOf('duo')).toBeLessThan(ids.indexOf('solo-with-promo'));
  });

  it('Sprint 155: supermarket unavailable é ignorado no cálculo', async () => {
    repoMock.findManyWithPrices.mockResolvedValue([
      makeEntity('duo-mas-1-off', [
        { slug: 'merc', price: 1.0, previousPrice: 1.2, onPromotion: true },
        { slug: 'dia', price: 2.0, available: false },
      ]),
    ] as never);
    const result = await service.featuredDeals(10);
    // Único available é merc com promo → savings=0.2 → entra
    expect(result.map((p) => p.id)).toEqual(['duo-mas-1-off']);
  });

  it('Sprint 155: previousPrice <= currentPrice não conta como deal', async () => {
    repoMock.findManyWithPrices.mockResolvedValue([
      makeEntity('no-real-promo', [
        { slug: 'merc', price: 2.0, previousPrice: 2.0, onPromotion: false },
      ]),
    ] as never);
    const result = await service.featuredDeals(10);
    expect(result).toHaveLength(0);
  });

  it('Sprint 156: promo antigo (updatedAt velho) ainda aparece no feature', async () => {
    // Repo S156 une produtos com previousPrice != null OU top-updated.
    // Mock reflecte isso: retorna o produto de promo antigo lado a lado
    // com cross-market recentes. Service lógica deve priorizar o promo
    // (saving maior).
    repoMock.findManyWithPrices.mockResolvedValue([
      makeEntity('aceite-hacendado-promo-antigo', [
        {
          slug: 'merc',
          price: 1.85,
          previousPrice: 8.6,
          onPromotion: true,
        },
      ]),
      makeEntity('leche-cross-market', [
        { slug: 'merc', price: 1.0 },
        { slug: 'dia', price: 1.5 },
      ]),
    ] as never);
    const result = await service.featuredDeals(10);
    const ids = result.map((p) => p.id);
    expect(ids).toContain('aceite-hacendado-promo-antigo');
    // 6.75 € savings > 0.5 € spread → promo antigo ranqueia primeiro
    expect(ids[0]).toBe('aceite-hacendado-promo-antigo');
  });
});

// Sprint 147: findMany filters nutriScore + sortBy nutriScore
describe('ProductsService.findMany — nutriScore filter + sort', () => {
  let service: ProductsService;
  let repoMock: { findMany: jest.Mock };

  const makeNutri = (id: string, fields: Record<string, number | null>) => ({
    id,
    name: `Prod ${id}`,
    brand: null,
    normalizedName: `prod-${id}`,
    ean: null,
    imageUrl: null,
    categoryId: null,
    category: {
      id: 'c1',
      slug: 'lacteos',
      nameEs: 'Lácteos',
      namePt: 'Laticínios',
      parentId: null,
      order: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any,
    packageSize: 1,
    packageUnit: 'LITER',
    comparisonUnit: 'LITER',
    calories: fields.calories ?? 100,
    protein: fields.protein ?? 5,
    fat: fields.fat ?? 2,
    saturatedFat: fields.saturatedFat ?? 1,
    carbs: fields.carbs ?? 10,
    sugar: fields.sugar ?? 5,
    salt: fields.salt ?? 0.1,
    fiber: fields.fiber ?? 2,
    nutritionPer: '100g',
    nutriScore: null,
    isVegan: false,
    isVegetarian: false,
    isGlutenFree: false,
    isLactoseFree: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    prices: [
      {
        id: `price-${id}`,
        productId: id,
        supermarketId: 'm',
        currentPrice: { toString: () => '1.00' } as any,
        previousPrice: null,
        onPromotion: false,
        isAvailable: true,
        isStale: false,
        lastSyncedAt: new Date(),
        confidenceScore: 1,
        source: 'official_api',
        createdAt: new Date(),
        updatedAt: new Date(),
        supermarket: {
          id: 'm',
          slug: 'mercadona',
          name: 'Mercadona',
          color: null,
          logoUrl: null,
          website: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ],
  });

  beforeEach(async () => {
    repoMock = { findMany: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: ProductsRepository, useValue: repoMock as any },
      ],
    }).compile();
    service = module.get(ProductsService);
  });

  it('filtra nutriScore=B retém apenas A e B (inclusivo)', async () => {
    // Montagem: produto "verde" (A) + "amarelo" (C). Nutri calculado no
    // DTO; aqui garantimos que o filtro drop C.
    repoMock.findMany.mockResolvedValue({
      items: [
        makeNutri('green', { calories: 40, sugar: 1, salt: 0.05, saturatedFat: 0, protein: 10, fiber: 5 }),
        makeNutri('red', { calories: 400, sugar: 30, salt: 1.5, saturatedFat: 15, protein: 2, fiber: 0 }),
      ],
      total: 2,
    });

    const res = await service.findMany({ nutriScore: 'B', page: 1, limit: 20, skip: 0 } as any);
    const grades = res.items.map((p) => p.nutriScore?.grade ?? null);
    for (const g of grades) {
      expect(['A', 'B']).toContain(g);
    }
    // Sprint 167: total reflete universo pós-filtro (filtered.length),
    // não página slice length. Neste mock, oversample retorna 2 itens;
    // 1 passa filter B → filteredTotal = 1 = items.length.
    expect(res.total).toBe(res.items.length);
  });

  it('sem filtro nutriScore retorna total original (não filtra)', async () => {
    repoMock.findMany.mockResolvedValue({
      items: [makeNutri('p1', {})],
      total: 42,
    });
    const res = await service.findMany({ page: 1, limit: 20 } as any);
    expect(res.total).toBe(42);
  });

  // ────────────────────────────────────────────────────────────
  // Sprint 167 — pagination bug fix
  // ────────────────────────────────────────────────────────────

  it('S167: nutriScore ativo → total = universo pós-filtro, NÃO page.length', async () => {
    // 10 produtos: 6 verdes (grade A/B) + 4 vermelhos (grade D/E).
    // User pede page=1, limit=3, nutriScore=B. Resultado esperado:
    // - total = 6 (universo filtrado)
    // - items.length = 3 (page slice)
    const items = [
      ...Array.from({ length: 6 }).map((_, i) =>
        makeNutri(`green-${i}`, {
          calories: 40,
          sugar: 1,
          salt: 0.05,
          saturatedFat: 0,
          protein: 10,
          fiber: 5,
        }),
      ),
      ...Array.from({ length: 4 }).map((_, i) =>
        makeNutri(`red-${i}`, {
          calories: 400,
          sugar: 30,
          salt: 1.5,
          saturatedFat: 15,
          protein: 2,
          fiber: 0,
        }),
      ),
    ];
    repoMock.findMany.mockResolvedValue({ items, total: 10 });

    const res = await service.findMany({
      nutriScore: 'B',
      page: 1,
      limit: 3,
      skip: 0,
    } as any);

    expect(res.total).toBe(6);
    expect(res.items.length).toBe(3);
    for (const p of res.items) {
      expect(['A', 'B']).toContain(p.nutriScore?.grade);
    }
  });

  it('S167: page 2 retorna slice consistente + total unchanged', async () => {
    // Mesmo mock de 10 itens (6 A/B + 4 D/E). page=2, limit=3.
    const items = [
      ...Array.from({ length: 6 }).map((_, i) =>
        makeNutri(`green-${i}`, {
          calories: 40,
          sugar: 1,
          salt: 0.05,
          saturatedFat: 0,
          protein: 10,
          fiber: 5,
        }),
      ),
      ...Array.from({ length: 4 }).map((_, i) =>
        makeNutri(`red-${i}`, {
          calories: 400,
          sugar: 30,
          salt: 1.5,
          saturatedFat: 15,
          protein: 2,
          fiber: 0,
        }),
      ),
    ];
    repoMock.findMany.mockResolvedValue({ items, total: 10 });

    const page1 = await service.findMany({
      nutriScore: 'B',
      page: 1,
      limit: 3,
      skip: 0,
    } as any);
    const page2 = await service.findMany({
      nutriScore: 'B',
      page: 2,
      limit: 3,
      skip: 3,
    } as any);

    expect(page1.total).toBe(page2.total);
    expect(page1.total).toBe(6);
    expect(page1.items.length).toBe(3);
    expect(page2.items.length).toBe(3);
    // Itens das duas páginas devem ser disjoint.
    const ids1 = new Set(page1.items.map((p) => p.id));
    const ids2 = page2.items.map((p) => p.id);
    for (const id of ids2) {
      expect(ids1.has(id)).toBe(false);
    }
  });

  it('S167: nutriScore oversample invoca repo com skip=0 + limit=20000 (não limit original)', async () => {
    repoMock.findMany.mockResolvedValue({
      items: [makeNutri('green', { calories: 40, sugar: 1, salt: 0.05, saturatedFat: 0, protein: 10, fiber: 5 })],
      total: 1,
    });

    await service.findMany({
      nutriScore: 'A',
      page: 3,
      limit: 20,
      skip: 40,
    } as any);

    expect(repoMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, limit: 20000 }),
    );
  });

  it('S167 AJUSTE: rawTotal > cap → throw AppException (fail-fast, não fallback silencioso)', async () => {
    repoMock.findMany.mockResolvedValue({
      items: [makeNutri('green', { calories: 40, sugar: 1, salt: 0.05, saturatedFat: 0, protein: 10, fiber: 5 })],
      total: 20001, // acima cap 20000
    });

    await expect(
      service.findMany({ nutriScore: 'A', page: 1, limit: 20, skip: 0 } as any),
    ).rejects.toMatchObject({
      errorCode: 'PRODUCTS.NUTRI_FILTER_CAP_EXCEEDED',
    });
  });

  it('S167: filter sem match → total=0 items=[]', async () => {
    repoMock.findMany.mockResolvedValue({
      items: [
        makeNutri('red', {
          calories: 500,
          sugar: 40,
          salt: 2,
          saturatedFat: 20,
          protein: 2,
          fiber: 0,
        }),
      ],
      total: 1,
    });

    const res = await service.findMany({
      nutriScore: 'A',
      page: 1,
      limit: 20,
      skip: 0,
    } as any);
    expect(res.total).toBe(0);
    expect(res.items).toEqual([]);
  });

  it('S167: sem nutriScore filter → path original paginado (repo recebe skip/limit solicitados)', async () => {
    repoMock.findMany.mockResolvedValue({
      items: [makeNutri('p1', {})],
      total: 42,
    });

    await service.findMany({
      page: 2,
      limit: 20,
      skip: 20,
    } as any);

    expect(repoMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, limit: 20 }),
    );
  });

  it('sortBy=nutriScore ordena A→E com nulls ao fim', async () => {
    repoMock.findMany.mockResolvedValue({
      items: [
        makeNutri('mid', { calories: 150, sugar: 10, salt: 0.5, saturatedFat: 3, protein: 5, fiber: 2 }),
        makeNutri('green', { calories: 40, sugar: 1, salt: 0.05, saturatedFat: 0, protein: 10, fiber: 5 }),
        makeNutri('red', { calories: 500, sugar: 40, salt: 2, saturatedFat: 20, protein: 2, fiber: 0 }),
      ],
      total: 3,
    });
    const res = await service.findMany({ sortBy: 'nutriScore', page: 1, limit: 20 } as any);
    const grades = res.items.map((p) => p.nutriScore?.grade ?? 'Z');
    const order: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4, Z: 5 };
    const sorted = [...grades].sort((a, b) => order[a] - order[b]);
    expect(grades).toEqual(sorted);
  });
});
