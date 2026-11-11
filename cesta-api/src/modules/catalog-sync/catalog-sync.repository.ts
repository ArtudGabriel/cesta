import { Injectable } from '@nestjs/common';
import { Prisma, Product, SyncRun } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

interface PersistPriceInput {
  productId: string;
  supermarketId: string;
  price: number;
  previousPrice: number | null;
  onPromotion: boolean;
  isAvailable: boolean;
  source: string;
}

@Injectable()
export class CatalogSyncRepository {
  constructor(private readonly prisma: PrismaService) {}

  findProductByEan(ean: string): Promise<Product | null> {
    return this.prisma.product.findFirst({
      where: { ean, deletedAt: null },
    });
  }

  findProductByNormalizedName(name: string): Promise<Product | null> {
    return this.prisma.product.findFirst({
      where: { normalizedName: name, deletedAt: null },
    });
  }

  findSupermarketBySlug(slug: string) {
    return this.prisma.supermarket.findUnique({ where: { slug } });
  }

  async upsertPrice(input: PersistPriceInput): Promise<{ created: boolean }> {
    const existing = await this.prisma.productPrice.findUnique({
      where: {
        productId_supermarketId: {
          productId: input.productId,
          supermarketId: input.supermarketId,
        },
      },
    });

    await this.prisma.productPrice.upsert({
      where: {
        productId_supermarketId: {
          productId: input.productId,
          supermarketId: input.supermarketId,
        },
      },
      create: {
        productId: input.productId,
        supermarketId: input.supermarketId,
        currentPrice: new Prisma.Decimal(input.price),
        previousPrice:
          input.previousPrice != null
            ? new Prisma.Decimal(input.previousPrice)
            : null,
        onPromotion: input.onPromotion,
        isAvailable: input.isAvailable,
        source: input.source,
        confidenceScore: new Prisma.Decimal(1.0),
        isStale: false,
        lastSyncedAt: new Date(),
      },
      update: {
        previousPrice: existing
          ? existing.currentPrice
          : input.previousPrice != null
            ? new Prisma.Decimal(input.previousPrice)
            : null,
        currentPrice: new Prisma.Decimal(input.price),
        onPromotion: input.onPromotion,
        isAvailable: input.isAvailable,
        source: input.source,
        confidenceScore: new Prisma.Decimal(1.0),
        isStale: false,
        lastSyncedAt: new Date(),
      },
    });

    await this.prisma.priceSnapshot.create({
      data: {
        productId: input.productId,
        supermarketId: input.supermarketId,
        price: new Prisma.Decimal(input.price),
        onPromotion: input.onPromotion,
        source: input.source,
      },
    });

    return { created: !existing };
  }

  async markStaleForSupermarket(
    supermarketId: string,
    threshold: Date,
  ): Promise<number> {
    const result = await this.prisma.productPrice.updateMany({
      where: {
        supermarketId,
        lastSyncedAt: { lt: threshold },
        isStale: false,
      },
      data: { isStale: true },
    });
    return result.count;
  }

  async upsertCandidate(input: {
    rawName: string;
    normalizedName: string;
    brand?: string | null;
    ean?: string | null;
    supermarketSlug: string;
    reportedPrice: number;
    packageHint?: string | null;
    categoryHint?: string | null;
  }): Promise<void> {
    await this.prisma.productCandidate.upsert({
      where: {
        normalizedName_supermarketSlug: {
          normalizedName: input.normalizedName,
          supermarketSlug: input.supermarketSlug,
        },
      },
      create: {
        rawName: input.rawName,
        normalizedName: input.normalizedName,
        brand: input.brand ?? null,
        ean: input.ean ?? null,
        supermarketSlug: input.supermarketSlug,
        reportedPrice: new Prisma.Decimal(input.reportedPrice),
        packageHint: input.packageHint ?? null,
        categoryHint: input.categoryHint ?? null,
      },
      update: {
        confirmations: { increment: 1 },
        reportedPrice: new Prisma.Decimal(input.reportedPrice),
      },
    });
  }

  createRun(supermarketSlug: string): Promise<SyncRun> {
    return this.prisma.syncRun.create({
      data: { supermarketSlug, status: 'running' },
    });
  }

  updateRun(
    id: string,
    data: Partial<{
      status: string;
      itemsProcessed: number;
      itemsCreated: number;
      itemsUpdated: number;
      itemsCandidate: number;
      itemsFailed: number;
      errorMessage: string | null;
      finishedAt: Date;
    }>,
  ): Promise<SyncRun> {
    return this.prisma.syncRun.update({ where: { id }, data });
  }

  listRuns(supermarketSlug?: string, limit = 20) {
    return this.prisma.syncRun.findMany({
      where: supermarketSlug ? { supermarketSlug } : undefined,
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }
}
