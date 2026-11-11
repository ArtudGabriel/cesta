import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import {
  PRICE_ALERTS_QUEUE,
  PriceAlertCheckJob,
} from '../alerts/alerts.processor';
import { PrismaService } from '../../database/prisma.service';

export const PRICE_CORRECTION_QUEUE = 'price-correction';

export interface PriceCorrectionJob {
  productId: string;
  supermarketId: string;
  reportedPrice: number;
  receiptId: string;
}

// Threshold: preço reportado diverge se |reported - current|/current > 2%
const DIVERGENCE_THRESHOLD = 0.02;

// Auto-update: 3 discrepâncias ativas em 7 dias com média próxima → atualiza
const AUTO_UPDATE_MIN_CONFIRMATIONS = 3;
const AUTO_UPDATE_WINDOW_DAYS = 7;

@Processor(PRICE_CORRECTION_QUEUE)
export class PriceCorrectionProcessor extends WorkerHost {
  private readonly logger = new Logger(PriceCorrectionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(PRICE_ALERTS_QUEUE)
    private readonly alertsQueue: Queue<PriceAlertCheckJob>,
  ) {
    super();
  }

  async process(job: Job<PriceCorrectionJob>): Promise<void> {
    const { productId, supermarketId, reportedPrice, receiptId } = job.data;

    const receipt = await this.prisma.receipt.findUnique({
      where: { id: receiptId },
      select: { userId: true },
    });
    if (!receipt) return;

    const productPrice = await this.prisma.productPrice.findUnique({
      where: { productId_supermarketId: { productId, supermarketId } },
    });
    if (!productPrice) return;

    const current = Number(productPrice.currentPrice);
    const divergence = Math.abs(reportedPrice - current) / current;

    if (divergence < DIVERGENCE_THRESHOLD) {
      // Reforça confiança — preço bate
      await this.prisma.productPrice.update({
        where: { id: productPrice.id },
        data: {
          confidenceScore: new Prisma.Decimal(
            Math.min(1.0, Number(productPrice.confidenceScore) + 0.05),
          ),
        },
      });
      return;
    }

    // Diverge — registra discrepância
    await this.prisma.priceDiscrepancy.create({
      data: {
        productPriceId: productPrice.id,
        reportedPrice: new Prisma.Decimal(reportedPrice),
        reportedByUserId: receipt.userId,
        receiptId,
      },
    });

    // Verifica se há N discrepâncias ativas em M dias com preços próximos
    const windowStart = new Date(
      Date.now() - AUTO_UPDATE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
    const recent = await this.prisma.priceDiscrepancy.findMany({
      where: {
        productPriceId: productPrice.id,
        resolved: false,
        createdAt: { gte: windowStart },
      },
    });

    if (recent.length < AUTO_UPDATE_MIN_CONFIRMATIONS) return;

    // Média dos preços reportados
    const avg =
      recent.reduce((sum, d) => sum + Number(d.reportedPrice), 0) /
      recent.length;

    // Todos os reports devem estar dentro de 3% da média (consistência)
    const allConsistent = recent.every(
      (d) => Math.abs(Number(d.reportedPrice) - avg) / avg < 0.03,
    );
    if (!allConsistent) return;

    // Atualiza ProductPrice com fonte crowdsourced
    await this.prisma.$transaction([
      this.prisma.productPrice.update({
        where: { id: productPrice.id },
        data: {
          previousPrice: productPrice.currentPrice,
          currentPrice: new Prisma.Decimal(Math.round(avg * 100) / 100),
          source: 'crowdsourced',
          confidenceScore: new Prisma.Decimal(0.9),
          isStale: false,
          lastSyncedAt: new Date(),
        },
      }),
      this.prisma.priceSnapshot.create({
        data: {
          productId,
          supermarketId,
          price: new Prisma.Decimal(Math.round(avg * 100) / 100),
          source: 'crowdsourced',
        },
      }),
      this.prisma.priceDiscrepancy.updateMany({
        where: { productPriceId: productPrice.id, resolved: false },
        data: { resolved: true },
      }),
    ]);

    await this.alertsQueue.add(
      'check',
      { productId, supermarketId },
      {
        jobId: `${productId}:${supermarketId}`,
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );

    this.logger.log(
      `Price auto-updated for product ${productId} @ ${supermarketId}: €${current} → €${avg.toFixed(2)} (${recent.length} confirmações)`,
    );
  }
}
