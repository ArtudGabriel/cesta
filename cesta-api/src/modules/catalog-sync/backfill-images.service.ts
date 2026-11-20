import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { put } from '@vercel/blob';
import { AppException } from '../../common/exceptions/app-exception';
import { PrismaService } from '../../database/prisma.service';
import { pickUserAgent, IDENTIFIED_UA } from './utils/user-agents';

// Sprint 133 (consolida S117 + migração imgix→Blob).
//
// Única fonte de imagem = Vercel Blob. Adapters nunca persistem URL de
// terceiro em Product.imageUrl; passam sourceUrl ao job from-source,
// que baixa + faz put() + atualiza o produto.
//
// Fluxos:
//  - `backfillFromSource({ productId, sourceUrl })`: ad-hoc (enfileirado
//    pelo CatalogSyncService quando raw.imageUrl vem do adapter e
//    Product.imageUrl não aponta para Blob). Pula resolução OFF.
//  - `scanAndBackfill(limit)`: cron fallback; resolve EAN via
//    OpenFoodFacts para produtos sem imagem e sem adapter oficial que
//    tenha thumbnail.

export const BLOB_HOST_SUFFIX = '.public.blob.vercel-storage.com';

export interface BackfillStats {
  scanned: number;
  uploaded: number;
  fallback: number;
  errored: number;
}

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product';
const DOWNLOAD_TIMEOUT_MS = 10_000;
const MIN_JITTER_MS = 300;
const MAX_JITTER_MS = 1200;

interface OffResponse {
  status: 0 | 1;
  product?: {
    image_front_url?: string | null;
    image_url?: string | null;
  } | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function inferContentType(url: string): string {
  const u = url.toLowerCase();
  if (u.includes('.webp')) return 'image/webp';
  if (u.includes('.png')) return 'image/png';
  if (u.includes('.jpg') || u.includes('.jpeg')) return 'image/jpeg';
  return 'image/jpeg';
}

function inferExtension(url: string): string {
  const u = url.toLowerCase();
  if (u.includes('.webp')) return 'webp';
  if (u.includes('.png')) return 'png';
  if (u.includes('.jpeg')) return 'jpeg';
  return 'jpg';
}

export function isBlobUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

@Injectable()
export class BackfillImagesService {
  private readonly logger = new Logger(BackfillImagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async scanAndBackfill(limit: number): Promise<BackfillStats> {
    this.assertBlobToken();

    const products = await this.prisma.product.findMany({
      where: { imageUrl: null, deletedAt: null },
      select: { id: true, name: true, ean: true },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });

    this.logger.log(
      `scanAndBackfill: ${products.length} produtos sem imagem (limit=${limit})`,
    );

    const stats: BackfillStats = {
      scanned: products.length,
      uploaded: 0,
      fallback: 0,
      errored: 0,
    };

    for (const p of products) {
      if (!p.ean) {
        stats.fallback += 1;
        continue;
      }

      const sourceUrl = await this.resolveOpenFoodFacts(p.ean);
      if (!sourceUrl) {
        stats.fallback += 1;
        continue;
      }

      const result = await this.downloadAndUpload(p.id, sourceUrl);
      if (result === 'uploaded') stats.uploaded += 1;
      else stats.errored += 1;
    }

    this.logger.log(
      `scanAndBackfill done: uploaded=${stats.uploaded} fallback=${stats.fallback} errored=${stats.errored}`,
    );
    return stats;
  }

  async backfillFromSource(input: {
    productId: string;
    sourceUrl: string;
  }): Promise<'uploaded' | 'errored' | 'skipped'> {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      this.logger.warn(
        `backfillFromSource: BLOB_READ_WRITE_TOKEN ausente — skip product=${input.productId}`,
      );
      return 'skipped';
    }

    const existing = await this.prisma.product.findUnique({
      where: { id: input.productId },
      select: { id: true, imageUrl: true, deletedAt: true },
    });
    if (!existing || existing.deletedAt) return 'skipped';
    // Race: outra thread já migrou para Blob. imageUrl não-Blob (imgix,
    // etc.) pode ser substituída → prossegue.
    if (isBlobUrl(existing.imageUrl)) return 'skipped';

    return this.downloadAndUpload(input.productId, input.sourceUrl);
  }

  private assertBlobToken(): void {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new AppException(
        'BACKFILL_IMAGES.MISSING_BLOB_TOKEN',
        'BLOB_READ_WRITE_TOKEN ausente — upload de imagem desabilitado',
        HttpStatus.FAILED_DEPENDENCY,
      );
    }
  }

  private async resolveOpenFoodFacts(ean: string): Promise<string | null> {
    await sleep(randomInt(MIN_JITTER_MS, MAX_JITTER_MS));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    try {
      const res = await fetch(`${OFF_BASE}/${encodeURIComponent(ean)}.json`, {
        headers: { 'User-Agent': IDENTIFIED_UA, Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) return null;
      const data = (await res.json()) as OffResponse;
      if (data.status !== 1 || !data.product) return null;
      return data.product.image_front_url ?? data.product.image_url ?? null;
    } catch {
      clearTimeout(timeout);
      return null;
    }
  }

  private async downloadAndUpload(
    productId: string,
    sourceUrl: string,
  ): Promise<'uploaded' | 'errored'> {
    this.logger.log(`download → ${productId} src=${sourceUrl}`);
    const bytes = await this.downloadBytes(sourceUrl);
    if (!bytes) {
      this.logger.warn(`download fail → ${productId}`);
      return 'errored';
    }

    const ext = inferExtension(sourceUrl);
    const contentType = inferContentType(sourceUrl);
    const blobKey = `products/${productId}.${ext}`;

    try {
      const result = await put(blobKey, bytes, {
        access: 'public',
        contentType,
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 31_536_000,
      });
      await this.prisma.product.update({
        where: { id: productId },
        data: { imageUrl: result.url },
      });
      this.logger.log(`upload ok → ${productId} url=${result.url}`);
      return 'uploaded';
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`upload fail → ${productId}: ${message}`);
      return 'errored';
    }
  }

  private async downloadBytes(url: string): Promise<Buffer | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': pickUserAgent() },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) return null;
      const arr = await res.arrayBuffer();
      return Buffer.from(arr);
    } catch {
      clearTimeout(timeout);
      return null;
    }
  }
}
