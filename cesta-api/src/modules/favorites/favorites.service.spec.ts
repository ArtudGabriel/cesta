import { Test } from '@nestjs/testing';
import { FavoritesRepository } from './favorites.repository';
import { FavoritesService } from './favorites.service';

describe('FavoritesService', () => {
  let service: FavoritesService;
  let repoMock: {
    findByUserAndProduct: jest.Mock;
    create: jest.Mock;
    deleteByUserAndProduct: jest.Mock;
    listByUserWithProduct: jest.Mock;
    findProductIdsByUser: jest.Mock;
  };

  beforeEach(async () => {
    repoMock = {
      findByUserAndProduct: jest.fn(),
      create: jest.fn(),
      deleteByUserAndProduct: jest.fn(),
      listByUserWithProduct: jest.fn(),
      findProductIdsByUser: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: FavoritesRepository, useValue: repoMock },
      ],
    }).compile();

    service = module.get(FavoritesService);
  });

  describe('add', () => {
    it('cria favorite novo e retorna created=true', async () => {
      repoMock.findByUserAndProduct.mockResolvedValue(null);
      repoMock.create.mockResolvedValue({
        id: 'f1',
        productId: 'p1',
        createdAt: new Date('2026-11-12'),
      });

      const result = await service.add('u1', 'p1');
      expect(result.created).toBe(true);
      expect(result.favorite.id).toBe('f1');
      expect(repoMock.create).toHaveBeenCalledWith('u1', 'p1');
    });

    it('é idempotente: retorna existente com created=false', async () => {
      repoMock.findByUserAndProduct.mockResolvedValue({
        id: 'f-existing',
        productId: 'p1',
        createdAt: new Date('2026-11-01'),
      });

      const result = await service.add('u1', 'p1');
      expect(result.created).toBe(false);
      expect(result.favorite.id).toBe('f-existing');
      expect(repoMock.create).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('chama deleteByUserAndProduct (idempotente)', async () => {
      repoMock.deleteByUserAndProduct.mockResolvedValue(undefined);
      await service.remove('u1', 'p1');
      expect(repoMock.deleteByUserAndProduct).toHaveBeenCalledWith('u1', 'p1');
    });

    it('não falha quando favorite não existe', async () => {
      repoMock.deleteByUserAndProduct.mockResolvedValue(undefined);
      await expect(service.remove('u1', 'missing')).resolves.toBeUndefined();
    });
  });

  describe('list', () => {
    it('retorna favoritos com cheapest price por produto', async () => {
      repoMock.listByUserWithProduct.mockResolvedValue([
        {
          id: 'f1',
          productId: 'p1',
          createdAt: new Date('2026-11-12'),
          product: {
            id: 'p1',
            name: 'Leche 1L',
            brand: 'Hacendado',
            imageUrl: null,
            packageSize: 1,
            packageUnit: 'LITER',
            comparisonUnit: 'LITER',
            isVegan: false,
            isVegetarian: false,
            isGlutenFree: false,
            isLactoseFree: false,
            prices: [
              {
                currentPrice: 0.95,
                supermarket: { slug: 'merc', name: 'Mercadona' },
              },
              {
                currentPrice: 0.93,
                supermarket: { slug: 'lidl', name: 'LIDL' },
              },
            ],
          },
        },
      ]);

      const result = await service.list('u1');
      expect(result).toHaveLength(1);
      expect(result[0].productId).toBe('p1');
      expect(result[0].product?.name).toBe('Leche 1L');
      expect(result[0].product?.isVegan).toBe(false);
      expect(result[0].cheapestPrice).toEqual({
        price: 0.93,
        supermarketSlug: 'lidl',
        supermarketName: 'LIDL',
        unitPrice: { value: 0.93, unit: 'L' },
      });
    });

    it('cheapestPrice null quando produto sem preços', async () => {
      repoMock.listByUserWithProduct.mockResolvedValue([
        {
          id: 'f1',
          productId: 'p1',
          createdAt: new Date(),
          product: {
            id: 'p1',
            name: 'Produto raro',
            brand: null,
            imageUrl: null,
            packageSize: 1,
            packageUnit: 'LITER',
            comparisonUnit: 'LITER',
            isVegan: false,
            isVegetarian: false,
            isGlutenFree: false,
            isLactoseFree: false,
            prices: [],
          },
        },
      ]);

      const result = await service.list('u1');
      expect(result[0].cheapestPrice).toBeNull();
    });
  });

  describe('check', () => {
    it('retorna ids favoritados do batch', async () => {
      repoMock.findProductIdsByUser.mockResolvedValue(['p1', 'p3']);
      const result = await service.check('u1', ['p1', 'p2', 'p3']);
      expect(result).toEqual(['p1', 'p3']);
    });

    it('array vazio quando sem ids', async () => {
      repoMock.findProductIdsByUser.mockResolvedValue([]);
      const result = await service.check('u1', []);
      expect(result).toEqual([]);
    });
  });
});
