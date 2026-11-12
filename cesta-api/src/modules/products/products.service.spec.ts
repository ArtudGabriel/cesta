import { Test } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { ProductsRepository } from './products.repository';

describe('ProductsService.suggest', () => {
  let service: ProductsService;
  let repoMock: { findSuggestions: jest.Mock };

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
    repoMock = { findSuggestions: jest.fn() };
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
