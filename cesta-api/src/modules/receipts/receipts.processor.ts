import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import { PrismaService } from '../../database/prisma.service';
import { fuzzyMatchProduct } from './fuzzy-match';
import { parseReceipt } from './receipt-parser';
import { ReceiptsRepository } from './receipts.repository';
import type { PriceCorrectionJob } from './price-correction.processor';
import { PRICE_CORRECTION_QUEUE } from './price-correction.processor';
import { RECEIPTS_QUEUE, ReceiptJob } from './receipts.queue';

export { RECEIPTS_QUEUE, ReceiptJob };

@Processor(RECEIPTS_QUEUE)
export class ReceiptsProcessor extends WorkerHost {
  private readonly logger = new Logger(ReceiptsProcessor.name);

  constructor(
    private readonly repo: ReceiptsRepository,
    private readonly prisma: PrismaService,
    @InjectQueue(PRICE_CORRECTION_QUEUE)
    private readonly priceQueue: Queue<PriceCorrectionJob>,
  ) {
    super();
  }

  async process(job: Job<ReceiptJob>): Promise<void> {
    const { receiptId, imagePath } = job.data;
    this.logger.log(`Processing receipt ${receiptId}`);

    try {
      await this.repo.updateStatus(receiptId, 'processing');

      const text = await this.runOcr(imagePath);
      const parsed = parseReceipt(text);

      let supermarketId: string | null = null;
      if (parsed.supermarketSlug) {
        const sm = await this.prisma.supermarket.findUnique({
          where: { slug: parsed.supermarketSlug },
        });
        supermarketId = sm?.id ?? null;
      }

      await this.repo.updateParsed(receiptId, {
        supermarketId,
        supermarketSlug: parsed.supermarketSlug,
        purchaseDate: parsed.purchaseDate,
        total: parsed.total,
        ocrRawText: text,
      });

      // Fuzzy fallback carrega candidatos UMA vez — se detectamos o mercado,
      // restringe ao catálogo daquele supermarket via productPrices (evita
      // 10k × N items Levenshtein). Sem mercado: fallback catálogo inteiro.
      const fuzzyCandidates = await this.prisma.product.findMany({
        where: {
          deletedAt: null,
          ...(supermarketId
            ? { prices: { some: { supermarketId } } }
            : {}),
        },
        select: { id: true, normalizedName: true },
      });

      // Matching: exato por normalizedName, fallback Levenshtein >= 0.7
      const items = await Promise.all(
        parsed.items.map(async (item) => {
          let productId: string | null = null;

          const exact = await this.prisma.product.findFirst({
            where: {
              normalizedName: item.normalizedName,
              deletedAt: null,
            },
            select: { id: true },
          });

          if (exact) {
            productId = exact.id;
          } else {
            productId = fuzzyMatchProduct(
              item.normalizedName,
              fuzzyCandidates,
              0.7,
            );
          }

          return {
            rawText: item.rawText,
            normalizedName: item.normalizedName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            productId,
            categoryHint: item.categoryHint,
          };
        }),
      );

      await this.repo.replaceItems(receiptId, items);
      await this.repo.updateStatus(receiptId, 'ready');

      // Dispara price-correction só pra items com produto matched e mercado detectado
      if (supermarketId) {
        const matched = items.filter((i) => i.productId);
        for (const item of matched) {
          await this.priceQueue.add('correct', {
            productId: item.productId!,
            supermarketId,
            reportedPrice: item.unitPrice,
            receiptId,
          });
        }
      }

      this.logger.log(
        `Receipt ${receiptId} ready: ${items.length} items, ${
          items.filter((i) => i.productId).length
        } matched`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Receipt ${receiptId} failed: ${message}`);
      await this.repo.updateStatus(receiptId, 'failed', message);
      throw error;
    }
  }

  private async runOcr(imagePath: string): Promise<string> {
    // Pre-process: grayscale + contrast normalization melhora OCR em
    // tickets amassados/foto com flash.
    const preprocessed = await sharp(imagePath)
      .rotate()
      .grayscale()
      .normalize()
      .toBuffer();

    const worker = await createWorker('spa');
    try {
      const result = await worker.recognize(preprocessed);
      return result.data.text ?? '';
    } finally {
      await worker.terminate();
    }
  }
}
