import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AlertsRepository } from './alerts.repository';

export const PRICE_ALERTS_QUEUE = 'price-alerts';

export interface PriceAlertCheckJob {
  productId: string;
  supermarketId: string;
}

// Mínimo de intervalo entre disparos pro mesmo alerta (dedupe)
const DEDUPE_HOURS = 6;

@Processor(PRICE_ALERTS_QUEUE)
export class PriceAlertsProcessor extends WorkerHost {
  private readonly logger = new Logger(PriceAlertsProcessor.name);

  constructor(
    private readonly repo: AlertsRepository,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<PriceAlertCheckJob>): Promise<void> {
    const { productId, supermarketId } = job.data;

    const productPrice = await this.prisma.productPrice.findUnique({
      where: { productId_supermarketId: { productId, supermarketId } },
      include: { supermarket: true, product: true },
    });
    if (!productPrice) return;

    const alerts = await this.repo.findActiveMatches(productId, supermarketId);
    if (alerts.length === 0) return;

    const currentPrice = Number(productPrice.currentPrice);
    const previousPrice = productPrice.previousPrice
      ? Number(productPrice.previousPrice)
      : null;
    const now = new Date();

    for (const alert of alerts) {
      if (alert.lastTriggeredAt) {
        const diff = now.getTime() - alert.lastTriggeredAt.getTime();
        if (diff < DEDUPE_HOURS * 60 * 60 * 1000) continue;
      }

      const reason = this.evaluate(alert, {
        currentPrice,
        previousPrice,
        onPromotion: productPrice.onPromotion,
        isAvailable: productPrice.isAvailable,
      });
      if (!reason) continue;

      const trigger = await this.repo.createTrigger({
        alertId: alert.id,
        reason,
        priceSnapshot: new Prisma.Decimal(currentPrice),
      });
      await this.repo.markTriggered(alert.id);

      const { sent, removed } = await this.notifications.sendToUser(alert.userId, {
        title: this.buildTitle(reason),
        body: `${productPrice.product.name} · ${productPrice.supermarket.name} · €${currentPrice.toFixed(2)}`,
        tag: `alert-${alert.id}`,
        data: {
          alertId: alert.id,
          productId,
          supermarketSlug: productPrice.supermarket.slug,
        },
      });

      if (sent > 0) {
        await this.repo.markNotified(trigger.id);
      }

      this.logger.log(
        `Alert ${alert.id} triggered (${reason}) → ${sent} enviadas, ${removed} removidas`,
      );
    }
  }

  private evaluate(
    alert: { type: string; targetPrice: Prisma.Decimal | null },
    state: {
      currentPrice: number;
      previousPrice: number | null;
      onPromotion: boolean;
      isAvailable: boolean;
    },
  ): string | null {
    switch (alert.type) {
      case 'promotion':
        return state.onPromotion ? 'promotion_started' : null;
      case 'target_price': {
        const target = alert.targetPrice ? Number(alert.targetPrice) : null;
        if (target == null) return null;
        return state.currentPrice <= target ? 'target_reached' : null;
      }
      case 'back_in_stock':
        return state.isAvailable ? 'back_in_stock' : null;
      case 'promotion_ending':
        // Heurística simples: foi promoção e não é mais
        if (
          !state.onPromotion &&
          state.previousPrice != null &&
          state.previousPrice < state.currentPrice
        ) {
          return 'promotion_ended';
        }
        return null;
      default:
        return null;
    }
  }

  private buildTitle(reason: string): string {
    switch (reason) {
      case 'promotion_started':
        return '¡Producto en promoción!';
      case 'target_reached':
        return 'Precio objetivo alcanzado';
      case 'back_in_stock':
        return 'Producto disponible de nuevo';
      case 'promotion_ended':
        return 'La promoción terminó';
      default:
        return 'Alerta de precio';
    }
  }
}
