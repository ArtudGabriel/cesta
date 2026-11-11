import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

type Members = {
  babies: number;
  kids: number;
  children: number;
  teens: number;
  adults: number;
  seniors: number;
};

type Answers = Record<string, boolean | string>;

interface GeneratedItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  isRequired: boolean;
  isLocked: boolean;
  position: number;
}

interface CategoryRule {
  slug: string;
  // Quantidade mensal base (em unidades do item vendido — ex: 1L, 1kg, ou 1 unit).
  // Multiplicada por memberUnits.
  monthlyPerMember: number;
  requiredAnswer?: { key: string; value: boolean | string };
  excludedAnswer?: { key: string; value: boolean | string };
}

const MEMBER_WEIGHT: Record<keyof Members, number> = {
  babies: 0.4,
  kids: 0.7,
  children: 0.9,
  teens: 1.1,
  adults: 1.0,
  seniors: 0.85,
};

const CATEGORY_RULES: CategoryRule[] = [
  { slug: 'lacteos', monthlyPerMember: 4, requiredAnswer: { key: 'eats_dairy', value: true } },
  { slug: 'pan-bolleria', monthlyPerMember: 3, requiredAnswer: { key: 'eats_bread', value: true } },
  { slug: 'carne', monthlyPerMember: 2.5, requiredAnswer: { key: 'eats_meat', value: true } },
  { slug: 'pescado', monthlyPerMember: 1.2, requiredAnswer: { key: 'eats_fish', value: true } },
  { slug: 'frutas-verduras', monthlyPerMember: 5 },
  { slug: 'bebidas', monthlyPerMember: 4 },
  { slug: 'despensa', monthlyPerMember: 3 },
  { slug: 'congelados', monthlyPerMember: 1 },
  { slug: 'limpieza', monthlyPerMember: 0.5 },
  { slug: 'higiene', monthlyPerMember: 0.6 },
  { slug: 'bebes', monthlyPerMember: 2 }, // só se houver babies
  { slug: 'mascotas', monthlyPerMember: 2, requiredAnswer: { key: 'has_pets', value: true } },
];

function memberUnits(members: Members): number {
  return (
    members.babies * MEMBER_WEIGHT.babies +
    members.kids * MEMBER_WEIGHT.kids +
    members.children * MEMBER_WEIGHT.children +
    members.teens * MEMBER_WEIGHT.teens +
    members.adults * MEMBER_WEIGHT.adults +
    members.seniors * MEMBER_WEIGHT.seniors
  );
}

function fruitsVeggiesMultiplier(answers: Answers): number {
  const choice = answers['fruits_veggies_frequency'];
  if (choice === 'daily') return 1.5;
  if (choice === 'weekly') return 1.0;
  if (choice === 'rarely') return 0.5;
  return 1.0;
}

function applyDietAdjustments(
  rule: CategoryRule,
  answers: Answers,
): number {
  if (answers.vegan === true) {
    if (['lacteos', 'carne', 'pescado'].includes(rule.slug)) return 0;
  }
  if (answers.vegetarian === true) {
    if (['carne', 'pescado'].includes(rule.slug)) return 0;
  }
  if (rule.slug === 'frutas-verduras') return fruitsVeggiesMultiplier(answers);
  return 1;
}

function matchesAnswers(rule: CategoryRule, answers: Answers): boolean {
  if (rule.requiredAnswer) {
    if (answers[rule.requiredAnswer.key] !== rule.requiredAnswer.value) {
      return false;
    }
  }
  if (rule.excludedAnswer) {
    if (answers[rule.excludedAnswer.key] === rule.excludedAnswer.value) {
      return false;
    }
  }
  return true;
}

@Injectable()
export class BasketGenerator {
  constructor(private readonly prisma: PrismaService) {}

  async generate(input: {
    members: Members;
    answers: Answers;
    restrictions: string[];
    blockedCategories: string[];
    requiredProductIds: string[];
    lockedExisting: Array<{ productId: string; quantity: number; unitPrice: number }>;
  }): Promise<GeneratedItem[]> {
    const {
      members,
      answers,
      restrictions,
      blockedCategories,
      requiredProductIds,
      lockedExisting,
    } = input;

    const units = Math.max(0.5, memberUnits(members));
    const picks = new Map<string, GeneratedItem>();
    let position = 0;

    // 1) Items locked existentes (regenerate preserva)
    for (const locked of lockedExisting) {
      picks.set(locked.productId, {
        productId: locked.productId,
        quantity: locked.quantity,
        unitPrice: locked.unitPrice,
        isRequired: false,
        isLocked: true,
        position: position++,
      });
    }

    // 2) Required product IDs
    for (const productId of requiredProductIds) {
      if (picks.has(productId)) continue;
      const product = await this.prisma.product.findFirst({
        where: { id: productId, deletedAt: null },
        include: {
          prices: {
            where: { isAvailable: true, supermarket: { isActive: true } },
            orderBy: { currentPrice: 'asc' },
          },
        },
      });
      if (!product || product.prices.length === 0) continue;
      picks.set(productId, {
        productId,
        quantity: 1,
        unitPrice: Number(product.prices[0].currentPrice),
        isRequired: true,
        isLocked: false,
        position: position++,
      });
    }

    // 3) Para cada regra de categoria, pega 1 produto representativo
    for (const rule of CATEGORY_RULES) {
      if (blockedCategories.includes(rule.slug)) continue;
      if (!matchesAnswers(rule, answers)) continue;

      // Pular bebés quando não tem babies
      if (rule.slug === 'bebes' && members.babies === 0) continue;

      const dietFactor = applyDietAdjustments(rule, answers);
      if (dietFactor === 0) continue;

      const baseQuantity = Math.round(rule.monthlyPerMember * units * dietFactor);
      if (baseQuantity <= 0) continue;

      const product = await this.pickCheapestInCategory(
        rule.slug,
        restrictions,
        answers,
      );
      if (!product) continue;
      if (picks.has(product.id)) continue;

      picks.set(product.id, {
        productId: product.id,
        quantity: baseQuantity,
        unitPrice: product.unitPrice,
        isRequired: false,
        isLocked: false,
        position: position++,
      });
    }

    return [...picks.values()];
  }

  private async pickCheapestInCategory(
    categorySlug: string,
    restrictions: string[],
    answers: Answers,
  ): Promise<{ id: string; unitPrice: number } | null> {
    const dietaryFilters: Record<string, boolean> = {};
    if (answers.vegan === true || restrictions.includes('vegan')) {
      dietaryFilters.isVegan = true;
    } else if (
      answers.vegetarian === true ||
      restrictions.includes('vegetarian')
    ) {
      dietaryFilters.isVegetarian = true;
    }
    if (answers.gluten_free === true || restrictions.includes('sin_gluten')) {
      dietaryFilters.isGlutenFree = true;
    }
    if (
      answers.lactose_intolerant === true ||
      restrictions.includes('sin_lactosa')
    ) {
      dietaryFilters.isLactoseFree = true;
    }

    const products = await this.prisma.product.findMany({
      where: {
        deletedAt: null,
        category: { slug: categorySlug },
        ...dietaryFilters,
      },
      include: {
        prices: {
          where: { isAvailable: true, supermarket: { isActive: true } },
          orderBy: { currentPrice: 'asc' },
          take: 1,
        },
      },
    });

    let best: { id: string; unitPrice: number } | null = null;
    for (const p of products) {
      if (p.prices.length === 0) continue;
      const price = Number(p.prices[0].currentPrice);
      if (!best || price < best.unitPrice) {
        best = { id: p.id, unitPrice: price };
      }
    }
    return best;
  }
}
