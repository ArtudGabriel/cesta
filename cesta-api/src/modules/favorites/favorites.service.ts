import { Injectable } from '@nestjs/common';
import { MeasureUnit } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { calculateUnitPrice } from '../../common/utils/price-normalization';
import {
  CheapestPriceDto,
  FavoriteResponseDto,
} from './dtos/favorite-response.dto';

interface RawCheapest {
  price: number;
  supermarketSlug: string;
  supermarketName: string;
}

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async add(
    userId: string,
    productId: string,
  ): Promise<{ favorite: FavoriteResponseDto; created: boolean }> {
    const existing = await this.prisma.favorite.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (existing) {
      return { favorite: this.mapBase(existing), created: false };
    }
    const favorite = await this.prisma.favorite.create({
      data: { userId, productId },
    });
    return { favorite: this.mapBase(favorite), created: true };
  }

  async remove(userId: string, productId: string): Promise<void> {
    await this.prisma.favorite.deleteMany({ where: { userId, productId } });
  }

  async list(userId: string): Promise<FavoriteResponseDto[]> {
    const favorites = await this.prisma.favorite.findMany({
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
    });

    return favorites.map((f) => {
      const cheapestRaw = this.pickCheapest(
        f.product.prices.map((p) => ({
          price: Number(p.currentPrice),
          supermarketSlug: p.supermarket.slug,
          supermarketName: p.supermarket.name,
        })),
      );
      const cheapest: CheapestPriceDto | null = cheapestRaw
        ? {
            ...cheapestRaw,
            unitPrice: this.safeUnitPrice(
              cheapestRaw.price,
              Number(f.product.packageSize),
              f.product.packageUnit,
              f.product.comparisonUnit,
            ),
          }
        : null;
      return {
        id: f.id,
        productId: f.productId,
        createdAt: f.createdAt,
        product: {
          id: f.product.id,
          name: f.product.name,
          brand: f.product.brand,
          imageUrl: f.product.imageUrl,
        },
        cheapestPrice: cheapest,
      };
    });
  }

  async check(userId: string, productIds: string[]): Promise<string[]> {
    if (productIds.length === 0) return [];
    const rows = await this.prisma.favorite.findMany({
      where: { userId, productId: { in: productIds } },
      select: { productId: true },
    });
    return rows.map((r) => r.productId);
  }

  private mapBase(
    favorite: { id: string; productId: string; createdAt: Date },
  ): FavoriteResponseDto {
    return {
      id: favorite.id,
      productId: favorite.productId,
      createdAt: favorite.createdAt,
    };
  }

  private pickCheapest(prices: RawCheapest[]): RawCheapest | null {
    if (prices.length === 0) return null;
    return prices.reduce((a, b) => (a.price <= b.price ? a : b));
  }

  private safeUnitPrice(
    price: number,
    packageSize: number,
    packageUnit: MeasureUnit,
    comparisonUnit: MeasureUnit,
  ) {
    try {
      return calculateUnitPrice(price, packageSize, packageUnit, comparisonUnit);
    } catch {
      return null;
    }
  }
}
