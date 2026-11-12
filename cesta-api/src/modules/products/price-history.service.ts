import { Injectable } from '@nestjs/common';
import { PriceHistorySeriesDto } from './dtos/price-history-response.dto';
import { PriceHistoryRepository } from './price-history.repository';

@Injectable()
export class PriceHistoryService {
  constructor(private readonly repo: PriceHistoryRepository) {}

  async getSeries(
    productId: string,
    options: { supermarketId?: string; days: number },
  ): Promise<PriceHistorySeriesDto[]> {
    const from = new Date(Date.now() - options.days * 24 * 60 * 60 * 1000);

    const snapshots = await this.repo.findSnapshotsByProduct(
      productId,
      from,
      options.supermarketId,
    );

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
