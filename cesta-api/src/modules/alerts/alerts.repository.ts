import { Injectable } from '@nestjs/common';
import {
  Alert,
  AlertRule,
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

  findAllActive(): Promise<AlertWithRelations[]> {
    return this.prisma.alert.findMany({
      where: { isActive: true, deletedAt: null },
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

  markAlertNotified(
    alertId: string,
    price: Prisma.Decimal,
    when: Date,
  ): Promise<Alert> {
    return this.prisma.alert.update({
      where: { id: alertId },
      data: { lastNotifiedAt: when, lastNotifiedPrice: price },
    });
  }

  // ──────────────────────────────────────────────────────────────
  // Sprint 105 — AlertRule (combo/trend/bundle)
  // ──────────────────────────────────────────────────────────────

  countActiveRulesByUser(userId: string): Promise<number> {
    return this.prisma.alertRule.count({
      where: { userId, isActive: true, deletedAt: null },
    });
  }

  findActiveRulesByUserAndType(
    userId: string,
    type: string,
  ): Promise<AlertRule[]> {
    return this.prisma.alertRule.findMany({
      where: { userId, type, isActive: true, deletedAt: null },
    });
  }

  findRulesByUser(
    userId: string,
    type?: string,
  ): Promise<AlertRule[]> {
    return this.prisma.alertRule.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  createRule(data: {
    userId: string;
    type: string;
    rules: Prisma.InputJsonValue;
  }): Promise<AlertRule> {
    return this.prisma.alertRule.create({ data });
  }

  findAllActiveRules(): Promise<AlertRule[]> {
    return this.prisma.alertRule.findMany({
      where: { isActive: true, deletedAt: null },
    });
  }

  // Sprint 160 — rule card inline actions
  findRuleByIdForUser(
    id: string,
    userId: string,
  ): Promise<AlertRule | null> {
    return this.prisma.alertRule.findFirst({
      where: { id, userId, deletedAt: null },
    });
  }

  updateRuleActive(id: string, isActive: boolean): Promise<AlertRule> {
    return this.prisma.alertRule.update({
      where: { id },
      data: { isActive },
    });
  }

  softDeleteRule(id: string): Promise<AlertRule> {
    return this.prisma.alertRule.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  markRuleNotified(
    ruleId: string,
    hash: string,
    when: Date,
  ): Promise<AlertRule> {
    return this.prisma.alertRule.update({
      where: { id: ruleId },
      data: {
        lastNotifiedAt: when,
        lastNotifiedHash: hash,
        lastTriggeredAt: when,
      },
    });
  }
}
