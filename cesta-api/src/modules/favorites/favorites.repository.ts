import { Injectable } from '@nestjs/common';
import { MeasureUnit } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface FavoriteRow {
  id: string;
  productId: string;
  createdAt: Date;
}

export interface FavoriteWithProductRow extends FavoriteRow {
  product: {
    id: string;
    name: string;
    brand: string | null;
    imageUrl: string | null;
    packageSize: unknown;
    packageUnit: MeasureUnit;
    comparisonUnit: MeasureUnit;
    prices: Array<{
      currentPrice: unknown;
      supermarket: { slug: string; name: string };
    }>;
  };
}

@Injectable()
export class FavoritesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUserAndProduct(
    userId: string,
    productId: string,
  ): Promise<FavoriteRow | null> {
    return this.prisma.favorite.findUnique({
      where: { userId_productId: { userId, productId } },
    });
  }

  create(userId: string, productId: string): Promise<FavoriteRow> {
    return this.prisma.favorite.create({ data: { userId, productId } });
  }

  async deleteByUserAndProduct(
    userId: string,
    productId: string,
  ): Promise<void> {
    await this.prisma.favorite.deleteMany({ where: { userId, productId } });
  }

  listByUserWithProduct(userId: string): Promise<FavoriteWithProductRow[]> {
    return this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
            imageUrl: true,
            packageSize: true,
            packageUnit: true,
            comparisonUnit: true,
            prices: {
              where: {
                isAvailable: true,
                supermarket: { isActive: true },
              },
              select: {
                currentPrice: true,
                supermarket: { select: { slug: true, name: true } },
              },
            },
          },
        },
      },
    }) as unknown as Promise<FavoriteWithProductRow[]>;
  }

  async findProductIdsByUser(
    userId: string,
    productIds: string[],
  ): Promise<string[]> {
    if (productIds.length === 0) return [];
    const rows = await this.prisma.favorite.findMany({
      where: { userId, productId: { in: productIds } },
      select: { productId: true },
    });
    return rows.map((r) => r.productId);
  }
}
