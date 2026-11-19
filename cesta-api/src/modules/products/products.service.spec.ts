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

describe('ProductsService.listCategories (S118)', () => {
  let service: ProductsService;
  let repoMock: { findCategories: jest.Mock };

  beforeEach(async () => {
    repoMock = { findCategories: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: ProductsRepository, useValue: repoMock },
      ],
    }).compile();
    service = module.get(ProductsService);
  });

  it('delega direto no repo (hierarquia parent → children)', async () => {
    const tree = [
      { id: 'c1', slug: 'leche', nameEs: 'Leche', children: [] },
      { id: 'c2', slug: 'carnes', nameEs: 'Carnes', children: [{ id: 'c2a', slug: 'bovino', nameEs: 'Bovino' }] },
    ];
    repoMock.findCategories.mockResolvedValue(tree);

    const result = await service.listCategories();
    expect(result).toBe(tree);
    expect(repoMock.findCategories).toHaveBeenCalledTimes(1);
  });
});
