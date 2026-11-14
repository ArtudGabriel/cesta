import { Injectable } from '@nestjs/common';
import {
  Category,
  Prisma,
  Product,
  ProductPrice,
  Supermarket,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ProductFiltersDto } from './dtos/product-filters.dto';

export type ProductWithPrices = Product & {
  prices: (ProductPrice & { supermarket: Supermarket })[];
  category: Category | null;
};

const PRICE_INCLUDE = {
  prices: {
    include: { supermarket: true },
    where: { supermarket: { isActive: true } },
  },
  // Sprint 61: category.slug alimenta o mapping de variante Nutri-Score em
  // `ProductResponseDto.fromEntity`.
  category: true,
} as const;

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(
    filters: ProductFiltersDto,
  ): Promise<{ items: ProductWithPrices[]; total: number }> {
    const where = await this.buildWhere(filters);
    const orderBy = this.buildOrderBy(filters.sortBy);

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: PRICE_INCLUDE,
        orderBy,
        skip: filters.skip,
        take: filters.limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, total };
  }

  findById(id: string): Promise<ProductWithPrices | null> {
    return this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: PRICE_INCLUDE,
    });
  }

  findManyByIds(ids: string[]): Promise<ProductWithPrices[]> {
    return this.prisma.product.findMany({
      where: { id: { in: ids }, deletedAt: null },
      include: PRICE_INCLUDE,
    });
  }

  async findSuggestions(q: string, limit: number): Promise<
    Array<{
      id: string;
      name: string;
      brand: string | null;
      imageUrl: string | null;
      prices: { currentPrice: Prisma.Decimal; supermarket: Supermarket }[];
    }>
  > {
    // startsWith prefere, depois contains. Prisma nao tem relevance score;
    // buscamos (limit*2) e priorizamos startsWith no sort em memoria.
    const take = Math.min(limit * 2, 40);
    const rows = await this.prisma.product.findMany({
      where: {
        deletedAt: null,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { brand: { contains: q, mode: 'insensitive' } },
        ],
      },
      take,
      select: {
        id: true,
        name: true,
        brand: true,
        imageUrl: true,
        prices: {
          where: { isAvailable: true, supermarket: { isActive: true } },
          orderBy: { currentPrice: 'asc' },
          take: 1,
          select: {
            currentPrice: true,
            supermarket: true,
          },
        },
      },
    });

    const qLower = q.toLowerCase();
    const scored = rows.map((r) => {
      const name = r.name.toLowerCase();
      const brand = r.brand?.toLowerCase() ?? '';
      const startsName = name.startsWith(qLower);
      const startsBrand = brand.startsWith(qLower);
      const score = startsName ? 0 : startsBrand ? 1 : 2;
      return { row: r, score };
    });
    scored.sort((a, b) => a.score - b.score);
    return scored.slice(0, limit).map((s) => s.row);
  }

  private async buildWhere(filters: ProductFiltersDto): Promise<Prisma.ProductWhereInput> {
    const where: Prisma.ProductWhereInput = { deletedAt: null };

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { brand: { contains: filters.search, mode: 'insensitive' } },
        { normalizedName: { contains: filters.search.toLowerCase() } },
      ];
    }

    if (filters.brand) {
      where.brand = { equals: filters.brand, mode: 'insensitive' };
    }

    if (filters.category) {
      const category = await this.prisma.category.findFirst({
        where: {
          OR: [{ id: filters.category }, { slug: filters.category }],
        },
        select: { id: true },
      });
      if (category) where.categoryId = category.id;
      else where.categoryId = '__none__'; // força zero resultado
    }

    const priceFilters: Prisma.ProductPriceWhereInput = { isAvailable: true };
    if (filters.supermarket) {
      priceFilters.supermarket = { slug: filters.supermarket };
    }
    if (filters.onPromotion) priceFilters.onPromotion = true;
    if (filters.maxPrice !== undefined) {
      priceFilters.currentPrice = { lte: new Prisma.Decimal(filters.maxPrice) };
    }
    if (Object.keys(priceFilters).length > 1 || filters.supermarket || filters.onPromotion || filters.maxPrice !== undefined) {
      where.prices = { some: priceFilters };
    }

    if (filters.isVegan) where.isVegan = true;
    if (filters.isVegetarian) where.isVegetarian = true;
    if (filters.isGlutenFree) where.isGlutenFree = true;
    if (filters.isLactoseFree) where.isLactoseFree = true;

    return where;
  }

  private buildOrderBy(
    sortBy: ProductFiltersDto['sortBy'] = 'cheapest',
  ): Prisma.ProductOrderByWithRelationInput {
    switch (sortBy) {
      case 'newest':
        return { createdAt: 'desc' };
      case 'name':
        return { name: 'asc' };
      case 'cheapest':
      default:
        // Ordena por nome; sort real por preço feito no service (pricePerUnit calculado)
        return { name: 'asc' };
    }
  }
}
