import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PriceHistorySeriesDto } from './dtos/price-history-response.dto';

@Injectable()
export class PriceHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getSeries(
    productId: string,
    options: { supermarketId?: string; days: number },
  ): Promise<PriceHistorySeriesDto[]> {
    const from = new Date(Date.now() - options.days * 24 * 60 * 60 * 1000);

    const snapshots = await this.prisma.priceSnapshot.findMany({
      where: {
        productId,
        capturedAt: { gte: from },
        ...(options.supermarketId && { supermarketId: options.supermarketId }),
      },
      orderBy: { capturedAt: 'asc' },
      include: { supermarket: true },
    });

    const bySupermarket = new Map<string, PriceHistorySeriesDto>();

    for (const snapshot of snapshots) {
      const supermarketId = snapshot.supermarketId;
      const entry =
        bySupermarket.get(supermarketId) ??
        ({
          supermarketId,
          supermarketSlug: snapshot.supermarket.slug,
          supermarketName: snapshot.supermarket.name,
          supermarketColor: snapshot.supermarket.color,
          points: [],
        } satisfies PriceHistorySeriesDto);

      entry.points.push({
        date: snapshot.capturedAt.toISOString(),
        price: Number(snapshot.price),
        onPromotion: snapshot.onPromotion,
      });

      bySupermarket.set(supermarketId, entry);
    }

    return [...bySupermarket.values()];
  }
}
