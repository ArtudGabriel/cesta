import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CheapestPriceDto,
  FavoriteResponseDto,
} from './dtos/favorite-response.dto';

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
      const cheapest = this.pickCheapest(
        f.product.prices.map((p) => ({
          price: Number(p.currentPrice),
          supermarketSlug: p.supermarket.slug,
          supermarketName: p.supermarket.name,
        })),
      );
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

  private pickCheapest(
    prices: CheapestPriceDto[],
  ): CheapestPriceDto | null {
    if (prices.length === 0) return null;
    return prices.reduce((a, b) => (a.price <= b.price ? a : b));
  }
}
