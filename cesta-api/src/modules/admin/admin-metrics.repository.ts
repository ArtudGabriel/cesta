import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface AlertRulesByTypeRow {
  type: string;
  count: number;
}

/**
 * Sprint 107: owner único das queries Prisma do dashboard admin. Regra #6
 * CLAUDE.md — AdminMetricsService nunca toca `prisma.*` direto. Todas as
 * agregações passam aqui, service só combina.
 */
@Injectable()
export class AdminMetricsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async countUsersActive(): Promise<number> {
    return this.prisma.user.count({ where: { deletedAt: null } });
  }

  async countDistinctActiveUsersSince(since: Date): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT user_id)::bigint AS count
      FROM refresh_tokens
      WHERE created_at >= ${since}
    `;
    return Number(rows[0]?.count ?? 0n);
  }

  async countSimpleAlertsActive(): Promise<number> {
    return this.prisma.alert.count({
      where: { isActive: true, deletedAt: null },
    });
  }

  async countAlertRulesByType(): Promise<AlertRulesByTypeRow[]> {
    const grouped = await this.prisma.alertRule.groupBy({
      by: ['type'],
      where: { isActive: true, deletedAt: null },
      _count: { _all: true },
    });
    return grouped.map((g) => ({
      type: g.type,
      count: g._count._all,
    }));
  }

  async countReceiptsByStatusSince(
    status: string,
    since: Date,
  ): Promise<number> {
    return this.prisma.receipt.count({
      where: { status, createdAt: { gte: since } },
    });
  }

  async countAlertsNotifiedSince(since: Date): Promise<number> {
    return this.prisma.alert.count({
      where: { lastNotifiedAt: { gte: since } },
    });
  }

  async countAlertRulesNotifiedSince(since: Date): Promise<number> {
    return this.prisma.alertRule.count({
      where: { lastNotifiedAt: { gte: since } },
    });
  }

  async countFamilyBasketsReadySince(since: Date): Promise<number> {
    return this.prisma.familyBasket.count({
      where: { status: 'ready', generatedAt: { gte: since } },
    });
  }
}
