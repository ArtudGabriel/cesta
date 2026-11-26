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

  /**
   * Sprint 132: produtos com 2+ preços disponíveis (candidatos a featured
   * deal). Cap no fetch pra evitar carregar catálogo inteiro — service
   * depois calcula spread + top N. Oversample 10x limit alvo (service pede
   * limit pequeno, 10-50).
   *
   * Sprint 156: agora retorna UNIÃO de duas sub-queries filtradas no DB:
   *  a) todos os produtos com `previousPrice != null` (promos atuais ou
   *     recentes — não limitado por `updatedAt` pq produtos de promo
   *     costumam ter `updatedAt` antigo quando o sync não os re-toca);
   *  b) top-updated com 2+ supers (preserva comportamento S132 cross-market).
   * Dedupe por `id`. Service decide por scoring. QA S155 detectou que
   * cap 500 + orderBy updatedAt mandava produtos de promo pra fora da
   * janela, section FeaturedDeals ficava vazia.
   */
  async findManyWithPrices(cap = 500): Promise<ProductWithPrices[]> {
    const [withPromo, recent] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          deletedAt: null,
          prices: {
            some: {
              isAvailable: true,
              previousPrice: { not: null },
            },
          },
        },
        include: PRICE_INCLUDE,
        take: cap,
      }),
      this.prisma.product.findMany({
        where: {
          deletedAt: null,
          prices: { some: { isAvailable: true } },
        },
        include: PRICE_INCLUDE,
        take: cap,
        orderBy: { updatedAt: 'desc' },
      }),
    ]);
    const byId = new Map<string, ProductWithPrices>();
    for (const row of withPromo) byId.set(row.id, row);
    for (const row of recent) if (!byId.has(row.id)) byId.set(row.id, row);
    return [...byId.values()];
  }

  async findForSearch(q: string, limit: number): Promise<{
    items: Array<{
      id: string;
      name: string;
      imageUrl: string | null;
      cheapestUnitPrice: number | null;
    }>;
    total: number;
  }> {
    // Sprint 106 (fix S106) — ILIKE em name/brand. Prisma não suporta orderBy
    // em agregado de relação 1:N (menor price per product) sem raw SQL. Pra
    // garantir "top N globais por cheapestUnitPrice", oversample (limit*3,
    // cap 40) e re-ordena+slica em memória (mesmo padrão de findSuggestions
    // L133). `take: limit` puro ordenava só rows arbitrárias do DB.
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
      ],
    };

    const sampleSize = Math.min(limit * 3, 40);

    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        take: sampleSize,
        select: {
          id: true,
          name: true,
          imageUrl: true,
          prices: {
            where: { isAvailable: true, supermarket: { isActive: true } },
            orderBy: { currentPrice: 'asc' },
            take: 1,
            select: { currentPrice: true },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    const scored = rows.map((r) => ({
      id: r.id,
      name: r.name,
      imageUrl: r.imageUrl,
      cheapestUnitPrice: r.prices[0]
        ? Number(r.prices[0].currentPrice)
        : null,
    }));

    scored.sort((a, b) => {
      const ap = a.cheapestUnitPrice ?? Number.POSITIVE_INFINITY;
      const bp = b.cheapestUnitPrice ?? Number.POSITIVE_INFINITY;
      return ap - bp;
    });

    return { items: scored.slice(0, limit), total };
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

    // Sprint 180 fuzzy fallback: ILIKE zero matches → tenta pg_trgm similarity.
    // GIN index idx_product_name_trgm + idx_product_brand_trgm aceleram operador %.
    // Threshold 0.3 Postgres default; tolera ~1-2 typos em palavra 5-6 chars.
    if (rows.length === 0 && q.trim().length >= 3) {
      const trgmIds = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Product"
        WHERE "deletedAt" IS NULL
          AND (
            similarity("name", ${q}) > 0.3
            OR ("brand" IS NOT NULL AND similarity("brand", ${q}) > 0.3)
          )
        ORDER BY GREATEST(
          similarity("name", ${q}),
          COALESCE(similarity("brand", ${q}), 0)
        ) DESC
        LIMIT ${take}
      `;
      if (trgmIds.length > 0) {
        const trgmRows = await this.prisma.product.findMany({
          where: { id: { in: trgmIds.map((r) => r.id) }, deletedAt: null },
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
        // Preserva ordem similaridade DESC retornada pelo raw query
        const byId = new Map(trgmRows.map((r) => [r.id, r]));
        return trgmIds
          .map((t) => byId.get(t.id))
          .filter((r): r is NonNullable<typeof r> => r !== undefined)
          .slice(0, limit);
      }
    }

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
    // Sprint 147: supermarkets[] (multi) tem precedência sobre supermarket single.
    if (filters.supermarkets && filters.supermarkets.length > 0) {
      priceFilters.supermarket = { slug: { in: filters.supermarkets } };
    } else if (filters.supermarket) {
      priceFilters.supermarket = { slug: filters.supermarket };
    }
    if (filters.onPromotion) priceFilters.onPromotion = true;
    // Preço range (inclusivo) sobre `currentPrice`.
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      const priceRange: Prisma.DecimalFilter = {};
      if (filters.minPrice !== undefined) {
        priceRange.gte = new Prisma.Decimal(filters.minPrice);
      }
      if (filters.maxPrice !== undefined) {
        priceRange.lte = new Prisma.Decimal(filters.maxPrice);
      }
      priceFilters.currentPrice = priceRange;
    }
    const hasPriceFilter =
      Object.keys(priceFilters).length > 1 ||
      filters.supermarket !== undefined ||
      (filters.supermarkets && filters.supermarkets.length > 0) ||
      filters.onPromotion !== undefined ||
      filters.minPrice !== undefined ||
      filters.maxPrice !== undefined;
    if (hasPriceFilter) {
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
