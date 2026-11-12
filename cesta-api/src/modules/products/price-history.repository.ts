import { Injectable } from '@nestjs/common';
import { PriceSnapshot, Supermarket } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export type SnapshotWithMarket = PriceSnapshot & { supermarket: Supermarket };

@Injectable()
export class PriceHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSnapshotsByProduct(
    productId: string,
    from: Date,
    supermarketId?: string,
  ): Promise<SnapshotWithMarket[]> {
    return this.prisma.priceSnapshot.findMany({
      where: {
        productId,
        capturedAt: { gte: from },
        ...(supermarketId && { supermarketId }),
      },
      orderBy: { capturedAt: 'asc' },
      include: { supermarket: true },
    });
  }
}
