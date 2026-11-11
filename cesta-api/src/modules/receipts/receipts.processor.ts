import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { createWorker } from 'tesseract.js';
import { PrismaService } from '../../database/prisma.service';
import { parseReceipt } from './receipt-parser';
import { ReceiptsRepository } from './receipts.repository';
import type { PriceCorrectionJob } from './price-correction.processor';
import { PRICE_CORRECTION_QUEUE } from './price-correction.processor';

export const RECEIPTS_QUEUE = 'receipts';

export interface ReceiptJob {
  receiptId: string;
  imagePath: string;
}

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

      // Matching por normalizedName contra catálogo
      const items = await Promise.all(
        parsed.items.map(async (item) => {
          const product = await this.prisma.product.findFirst({
            where: {
              normalizedName: item.normalizedName,
              deletedAt: null,
            },
            select: { id: true },
          });
          return {
            rawText: item.rawText,
            normalizedName: item.normalizedName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            productId: product?.id ?? null,
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
    const worker = await createWorker('spa');
    try {
      const result = await worker.recognize(imagePath);
      return result.data.text ?? '';
    } finally {
      await worker.terminate();
    }
  }
}
