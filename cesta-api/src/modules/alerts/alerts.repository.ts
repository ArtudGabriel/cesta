import { Injectable } from '@nestjs/common';
import {
  Alert,
  AlertTrigger,
  Prisma,
  Product,
  Supermarket,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export type AlertWithRelations = Alert & {
  product: Product;
  supermarket: Supermarket | null;
  triggers: AlertTrigger[];
};

const ALERT_INCLUDE = {
  product: true,
  supermarket: true,
  triggers: {
    orderBy: { createdAt: 'desc' as const },
    take: 10,
  },
} as const;

@Injectable()
export class AlertsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllByUser(userId: string): Promise<AlertWithRelations[]> {
    return this.prisma.alert.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: ALERT_INCLUDE,
    });
  }

  findByIdForUser(
    id: string,
    userId: string,
  ): Promise<AlertWithRelations | null> {
    return this.prisma.alert.findFirst({
      where: { id, userId, deletedAt: null },
      include: ALERT_INCLUDE,
    });
  }

  create(data: Prisma.AlertUncheckedCreateInput): Promise<AlertWithRelations> {
    return this.prisma.alert.create({ data, include: ALERT_INCLUDE });
  }

  update(
    id: string,
    data: Prisma.AlertUpdateInput,
  ): Promise<AlertWithRelations> {
    return this.prisma.alert.update({
      where: { id },
      data,
      include: ALERT_INCLUDE,
    });
  }

  softDelete(id: string): Promise<Alert> {
    return this.prisma.alert.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  findActiveMatches(
    productId: string,
    supermarketId: string,
  ): Promise<AlertWithRelations[]> {
    return this.prisma.alert.findMany({
      where: {
        productId,
        isActive: true,
        deletedAt: null,
        OR: [{ supermarketId }, { supermarketId: null }],
      },
      include: ALERT_INCLUDE,
    });
  }

  createTrigger(data: Prisma.AlertTriggerUncheckedCreateInput) {
    return this.prisma.alertTrigger.create({ data });
  }

  markTriggered(alertId: string): Promise<Alert> {
    return this.prisma.alert.update({
      where: { id: alertId },
      data: { lastTriggeredAt: new Date() },
    });
  }

  markNotified(triggerId: string) {
    return this.prisma.alertTrigger.update({
      where: { id: triggerId },
      data: { notifiedAt: new Date() },
    });
  }
}
