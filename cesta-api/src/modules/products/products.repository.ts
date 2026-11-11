import { Injectable } from '@nestjs/common';
import { Prisma, Product, ProductPrice, Supermarket } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ProductFiltersDto } from './dtos/product-filters.dto';

export type ProductWithPrices = Product & {
  prices: (ProductPrice & { supermarket: Supermarket })[];
};

const PRICE_INCLUDE = {
  prices: {
    include: { supermarket: true },
    where: { supermarket: { isActive: true } },
  },
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
