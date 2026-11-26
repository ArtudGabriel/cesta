import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { withBandwidthOptions } from '../../common/bullmq/worker-options';
import { NotificationsService } from '../notifications/notifications.service';
import { AlertsRepository } from './alerts.repository';

export const ALERT_PRICE_CHECK_QUEUE = 'alert-price-check';
export type AlertPriceCheckJob = Record<string, never>;

/**
 * Sprint 96 cron 2h. Varre alertas ativos vs ProductPrice atual e enfileira
 * push notification quando a condição dispara. Idempotente: só reenvia se
 * currentPrice != lastNotifiedPrice (ou nunca notificou).
 */
@Processor(ALERT_PRICE_CHECK_QUEUE, withBandwidthOptions())
export class AlertPriceCheckProcessor
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(AlertPriceCheckProcessor.name);

  constructor(
    private readonly repo: AlertsRepository,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    @InjectQueue(ALERT_PRICE_CHECK_QUEUE)
    private readonly queue: Queue<AlertPriceCheckJob>,
  ) {
    super();
  }

  onModuleInit(): void {
    setImmediate(() => void this.scheduleCron());
  }

  private async scheduleCron(): Promise<void> {
    const enabled =
      this.config.get<string>('ALERT_PRICE_CHECK_CRON_ENABLED', 'false') ===
      'true';
    if (!enabled) {
      this.logger.log(
        'AlertPriceCheck cron DISABLED via env (MVP $0/mês Redis quota)',
      );
      return;
    }
    const cron = this.config.get<string>(
      'CRON_ALERT_PRICE_CHECK',
      '0 */2 * * *',
    );
    try {
      await this.queue.add(
        'price-check-scan',
        {},
        {
          jobId: 'cron-alert-price-check',
          repeat: { pattern: cron, tz: 'Europe/Madrid' },
          removeOnComplete: 50,
          removeOnFail: 50,
        },
      );
      this.logger.log(`AlertPriceCheck cron scheduled "${cron}"`);
    } catch (err) {
      this.logger.error(
        `AlertPriceCheck cron schedule failed: ${(err as Error).message}`,
      );
    }
  }

  async process(job: Job<AlertPriceCheckJob>): Promise<void> {
    if (job.name !== 'price-check-scan') return;
    const alerts = await this.repo.findAllActive();
    if (alerts.length === 0) return;

    const now = new Date();
    let notified = 0;

    for (const alert of alerts) {
      const price = await this.loadPrice(alert.productId, alert.supermarketId);
      if (!price) continue;

      const currentPrice = Number(price.currentPrice);
      const previousPrice = price.previousPrice
        ? Number(price.previousPrice)
        : null;
      const reason = this.evaluate(alert, {
        currentPrice,
        previousPrice,
        onPromotion: price.onPromotion,
        isAvailable: price.isAvailable,
      });
      if (!reason) continue;

      if (
        alert.lastNotifiedPrice != null &&
        Number(alert.lastNotifiedPrice) === currentPrice
      ) {
        continue;
      }

      const trigger = await this.repo.createTrigger({
        alertId: alert.id,
        reason,
        priceSnapshot: new Prisma.Decimal(currentPrice),
      });
      await this.repo.markTriggered(alert.id);

      const { sent } = await this.notifications.sendToUser(alert.userId, {
        title: this.buildTitle(reason),
        body: `${price.product.name} · ${price.supermarket.name} · €${currentPrice.toFixed(2)}`,
        tag: `alert-${alert.id}`,
        data: {
          alertId: alert.id,
          productId: alert.productId,
          supermarketSlug: price.supermarket.slug,
          url: `/produto/${alert.productId}`,
        },
      });

      if (sent > 0) {
        await this.repo.markNotified(trigger.id);
      }
      await this.repo.markAlertNotified(
        alert.id,
        new Prisma.Decimal(currentPrice),
        now,
      );
      notified++;
    }

    this.logger.log(
      `AlertPriceCheck scan: ${alerts.length} alertas ativos, ${notified} disparados`,
    );
  }

  private loadPrice(productId: string, supermarketId: string | null) {
    if (supermarketId) {
      return this.prisma.productPrice.findUnique({
        where: { productId_supermarketId: { productId, supermarketId } },
        include: { product: true, supermarket: true },
      });
    }
    return this.prisma.productPrice.findFirst({
      where: { productId, isAvailable: true },
      orderBy: { currentPrice: 'asc' },
      include: { product: true, supermarket: true },
    });
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
