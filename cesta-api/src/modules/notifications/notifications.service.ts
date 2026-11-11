import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { SubscribeDto } from './dtos/subscribe.dto';
import * as webPush from 'web-push';

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly isConfigured: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const pub = this.config.get<string>('VAPID_PUBLIC_KEY');
    const priv = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.config.get<string>('VAPID_SUBJECT', 'mailto:noreply@cesta.app');
    this.isConfigured =
      Boolean(pub && priv && pub !== 'disabled' && priv !== 'disabled');
    if (this.isConfigured) {
      webPush.setVapidDetails(subject, pub!, priv!);
    }
  }

  onModuleInit(): void {
    if (!this.isConfigured) {
      this.logger.warn(
        'VAPID keys não configuradas. Push notifications desativadas (web-push em no-op).',
      );
    }
  }

  getPublicKey(): { publicKey: string | null } {
    if (!this.isConfigured) return { publicKey: null };
    return { publicKey: this.config.getOrThrow<string>('VAPID_PUBLIC_KEY') };
  }

  async subscribe(userId: string, dto: SubscribeDto): Promise<void> {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: dto.userAgent ?? null,
      },
      update: {
        userId,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
      },
    });
  }

  async unsubscribe(endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
  }

  async sendToUser(
    userId: string,
    payload: NotificationPayload,
  ): Promise<{ sent: number; removed: number }> {
    if (!this.isConfigured) return { sent: 0, removed: 0 };

    const subs = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });

    let sent = 0;
    let removed = 0;
    for (const sub of subs) {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
        );
        sent += 1;
      } catch (error) {
        const status =
          typeof error === 'object' && error !== null && 'statusCode' in error
            ? (error as { statusCode: number }).statusCode
            : null;
        // 410/404 = subscription expirada/removida — limpa
        if (status === 404 || status === 410) {
          await this.prisma.pushSubscription.delete({ where: { id: sub.id } });
          removed += 1;
        } else {
          this.logger.warn(
            `Push falhou para ${sub.endpoint.slice(0, 40)}…: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    }
    return { sent, removed };
  }
}
