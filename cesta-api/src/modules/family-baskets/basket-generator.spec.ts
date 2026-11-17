import { Test } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { BasketGenerator } from './basket-generator';

describe('BasketGenerator', () => {
  let generator: BasketGenerator;
  let prisma: {
    product: { findFirst: jest.Mock; findMany: jest.Mock };
  };

  const bread = {
    id: 'p-bread',
    prices: [{ currentPrice: 1.2 }],
  };
  const milk = {
    id: 'p-milk',
    prices: [{ currentPrice: 0.95 }],
  };
  const fruit = {
    id: 'p-fruit',
    prices: [{ currentPrice: 1.5 }],
  };
  const meat = {
    id: 'p-meat',
    prices: [{ currentPrice: 7.5 }],
  };

  beforeEach(async () => {
    prisma = {
      product: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockImplementation(({ where }) => {
          const slug = where?.category?.slug;
          switch (slug) {
            case 'pan-bolleria':
              return Promise.resolve([bread]);
            case 'lacteos':
              return Promise.resolve([milk]);
            case 'frutas-verduras':
              return Promise.resolve([fruit]);
            case 'carne':
              return Promise.resolve([meat]);
            default:
              return Promise.resolve([]);
          }
        }),
      },
    };
    const module = await Test.createTestingModule({
      providers: [
        BasketGenerator,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    generator = module.get(BasketGenerator);
  });

  const BASE_MEMBERS = {
    babies: 0,
    kids: 0,
    children: 0,
    teens: 0,
    adults: 2,
    seniors: 0,
  };

  it('preserva items locked existentes na mesma posição (0)', async () => {
    const result = await generator.generate({
      members: BASE_MEMBERS,
      answers: { eats_bread: true, eats_dairy: true, eats_meat: false },
      restrictions: [],
      blockedCategories: [],
      requiredProductIds: [],
      lockedExisting: [
        { productId: 'p-locked-abc', quantity: 3, unitPrice: 2.0 },
      ],
    });

    const locked = result.find((i) => i.productId === 'p-locked-abc');
    expect(locked).toBeDefined();
    expect(locked!.isLocked).toBe(true);
    expect(locked!.quantity).toBe(3);
    expect(locked!.position).toBe(0);
  });

  it('vegan filter exclui carne e lacteos (dietFactor = 0)', async () => {
    const result = await generator.generate({
      members: BASE_MEMBERS,
      answers: { vegan: true, eats_meat: true, eats_dairy: true },
      restrictions: ['vegan'],
      blockedCategories: [],
      requiredProductIds: [],
      lockedExisting: [],
    });

    const ids = result.map((i) => i.productId);
    expect(ids).not.toContain(meat.id);
    expect(ids).not.toContain(milk.id);
  });

  it('blockedCategories pula categoria mesmo com answer positiva', async () => {
    const result = await generator.generate({
      members: BASE_MEMBERS,
      answers: { eats_bread: true },
      restrictions: [],
      blockedCategories: ['pan-bolleria'],
      requiredProductIds: [],
      lockedExisting: [],
    });

    expect(result.map((i) => i.productId)).not.toContain(bread.id);
  });

  it('budget ajusta quantidades proporcionalmente nos non-locked', async () => {
    const result = await generator.generate({
      members: BASE_MEMBERS,
      answers: { eats_bread: true, eats_dairy: true },
      restrictions: [],
      blockedCategories: [],
      requiredProductIds: [],
      lockedExisting: [
        { productId: 'p-locked', quantity: 1, unitPrice: 100 },
      ],
      monthlyBudget: 100.5,
    });

    const locked = result.find((i) => i.productId === 'p-locked');
    expect(locked!.quantity).toBe(1);
    expect(locked!.unitPrice).toBe(100);

    // Qualquer item non-locked tem qty ajustada pra respeitar budget-fixed=0.5
    for (const item of result) {
      if (item.productId === 'p-locked') continue;
      expect(item.quantity).toBeGreaterThanOrEqual(1);
    }
  });
});
