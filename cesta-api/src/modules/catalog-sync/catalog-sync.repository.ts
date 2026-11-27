import { Injectable } from '@nestjs/common';
import { MeasureUnit, Prisma, Product, SyncRun } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { RawProduct } from './adapters/supermarket-adapter.interface';

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

  // Sprint 116: cria Product a partir de raw de adapter oficial quando o
  // match por EAN/normalizedName falha (catálogo vazio). Mirror do
  // scripts/sync-mercadona.ts (S108). Mantém candidate pipeline pra
  // adapters crowdsourced onde confiança é menor.
  //
  // Sprint 133: imageUrl sempre null na criação. Política Blob-only —
  // raw.imageUrl vira apenas sourceUrl pro BackfillImagesService.
  // Ver docs/adr/0008-image-pipeline-blob-only.md.
  //
  // Sprint 142: categoryId resolvido via CategoryResolver no service.
  // Audit revelou 99.7% produtos com category_id=NULL — adapters
  // coletavam categoryHint mas o persist path ignorava.
  //
  // Sprint 224 (MVP Bloco 2): persiste raw.imageUrl em sourceImageUrl.
  // Preserva invariante ADR 0008 (imageUrl segue Blob/R2 only) +
  // elimina dependência de EAN no scan-and-backfill.
  createProductFromRaw(
    raw: RawProduct,
    normalizedName: string,
    categoryId: string | null,
  ): Promise<Product> {
    return this.prisma.product.create({
      data: {
        name: raw.name,
        normalizedName,
        brand: raw.brand ?? null,
        ean: raw.ean ?? null,
        imageUrl: null,
        sourceImageUrl: raw.imageUrl ?? null,
        categoryId: categoryId ?? null,
        packageSize: new Prisma.Decimal(raw.packageSize),
        packageUnit: raw.packageUnit as unknown as MeasureUnit,
        comparisonUnit: raw.comparisonUnit as unknown as MeasureUnit,
      },
    });
  }

  /** Sprint 224: atualiza sourceImageUrl pra produto existente quando
   *  adapter traz raw.imageUrl novo (re-sync nightly rebuilda a pista
   *  pra produtos legacy sem a coluna populada). */
  async updateSourceImageUrl(
    productId: string,
    sourceImageUrl: string,
  ): Promise<void> {
    await this.prisma.product.update({
      where: { id: productId },
      data: { sourceImageUrl },
    });
  }

  /** Sprint 142: atualiza categoryId pra produtos legacy (backfill) e
   *  pra qualquer produto que o adapter rematchou sem categoria. */
  async updateCategoryId(
    productId: string,
    categoryId: string,
  ): Promise<void> {
    await this.prisma.product.update({
      where: { id: productId },
      data: { categoryId },
    });
  }

  /** Cache lookup Category.slug → id. Chamado 1× por sync run; map in
   *  memória evita N queries durante iteração de produtos. */
  async loadCategoryIdMap(): Promise<Map<string, string>> {
    const rows = await this.prisma.category.findMany({
      select: { id: true, slug: true },
    });
    return new Map(rows.map((r) => [r.slug, r.id]));
  }

  findProductsWithoutCategory(limit: number): Promise<
    Array<{ id: string; name: string; brand: string | null }>
  > {
    return this.prisma.product.findMany({
      where: { categoryId: null, deletedAt: null },
      select: { id: true, name: true, brand: true },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });
  }

  findSupermarketBySlug(slug: string) {
    return this.prisma.supermarket.findUnique({ where: { slug } });
  }

  /**
   * Sprint 124: adapter introduzido pós-seed expõe definition e service
   * upserta antes de runFor. Idempotente, não sobrescreve nome/color se já
   * existir (apenas cria se missing).
   */
  async ensureSupermarket(def: {
    slug: string;
    name: string;
    color: string;
  }) {
    return this.prisma.supermarket.upsert({
      where: { slug: def.slug },
      create: { slug: def.slug, name: def.name, color: def.color },
      update: {},
    });
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
