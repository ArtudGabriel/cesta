import { Test } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { FavoritesService } from './favorites.service';

describe('FavoritesService', () => {
  let service: FavoritesService;
  let prismaMock: {
    favorite: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      favorite: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(FavoritesService);
  });

  describe('add', () => {
    it('cria favorite novo e retorna created=true', async () => {
      prismaMock.favorite.findUnique.mockResolvedValue(null);
      prismaMock.favorite.create.mockResolvedValue({
        id: 'f1',
        productId: 'p1',
        createdAt: new Date('2026-11-12'),
      });

      const result = await service.add('u1', 'p1');
      expect(result.created).toBe(true);
      expect(result.favorite.id).toBe('f1');
      expect(prismaMock.favorite.create).toHaveBeenCalledWith({
        data: { userId: 'u1', productId: 'p1' },
      });
    });

    it('é idempotente: retorna existente com created=false', async () => {
      prismaMock.favorite.findUnique.mockResolvedValue({
        id: 'f-existing',
        productId: 'p1',
        createdAt: new Date('2026-11-01'),
      });

      const result = await service.add('u1', 'p1');
      expect(result.created).toBe(false);
      expect(result.favorite.id).toBe('f-existing');
      expect(prismaMock.favorite.create).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('chama deleteMany (idempotente)', async () => {
      prismaMock.favorite.deleteMany.mockResolvedValue({ count: 1 });
      await service.remove('u1', 'p1');
      expect(prismaMock.favorite.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1', productId: 'p1' },
      });
    });

    it('não falha quando favorite não existe', async () => {
      prismaMock.favorite.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.remove('u1', 'missing')).resolves.toBeUndefined();
    });
  });

  describe('list', () => {
    it('retorna favoritos com cheapest price por produto', async () => {
      prismaMock.favorite.findMany.mockResolvedValue([
        {
          id: 'f1',
          productId: 'p1',
          createdAt: new Date('2026-11-12'),
          product: {
            id: 'p1',
            name: 'Leche 1L',
            brand: 'Hacendado',
            imageUrl: null,
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
      expect(result[0].cheapestPrice).toEqual({
        price: 0.93,
        supermarketSlug: 'lidl',
        supermarketName: 'LIDL',
      });
    });

    it('cheapestPrice null quando produto sem preços', async () => {
      prismaMock.favorite.findMany.mockResolvedValue([
        {
          id: 'f1',
          productId: 'p1',
          createdAt: new Date(),
          product: {
            id: 'p1',
            name: 'Produto raro',
            brand: null,
            imageUrl: null,
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
      prismaMock.favorite.findMany.mockResolvedValue([
        { productId: 'p1' },
        { productId: 'p3' },
      ]);
      const result = await service.check('u1', ['p1', 'p2', 'p3']);
      expect(result).toEqual(['p1', 'p3']);
    });

    it('array vazio quando sem ids', async () => {
      const result = await service.check('u1', []);
      expect(result).toEqual([]);
      expect(prismaMock.favorite.findMany).not.toHaveBeenCalled();
    });
  });
});
