import { Injectable, Logger } from '@nestjs/common';
import { AdminMetricsRepository } from './admin-metrics.repository';

const KNOWN_RULE_TYPES = ['combo', 'trend', 'bundle'] as const;
export type AlertRuleType = (typeof KNOWN_RULE_TYPES)[number];

export interface AlertsActiveByType {
  simple: number;
  combo: number;
  trend: number;
  bundle: number;
}

export interface ReceiptsLast30d {
  parsed: number;
  failed: number;
}

export interface AdminMetricsSnapshot {
  usersTotal: number;
  usersActive7d: number;
  alertsActiveByType: AlertsActiveByType;
  receipts30d: ReceiptsLast30d;
  pushNotifications7d: number;
  familyBasketsGenerated7d: number;
  generatedAt: string;
  cached: boolean;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const CACHE_KEY = 'admin-metrics:v1';

/**
 * Sprint 107: agregador do dashboard admin. 8 queries disparadas em
 * paralelo via `Promise.all` e cacheadas in-memory por `METRICS_CACHE_TTL_MS`
 * (default 5min). Cache é opaco ao caller — flag `cached` no snapshot é só
 * observabilidade. Ver ADR-0007.
 */
@Injectable()
export class AdminMetricsService {
  private readonly logger = new Logger(AdminMetricsService.name);
  private readonly ttlMs: number;
  private cache = new Map<
    string,
    { value: AdminMetricsSnapshot; expiresAt: number }
  >();

  constructor(private readonly repo: AdminMetricsRepository) {
    const raw = process.env.METRICS_CACHE_TTL_MS;
    const parsed = raw ? Number(raw) : NaN;
    this.ttlMs =
      Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TTL_MS;
  }

  async getSnapshot(now: Date = new Date()): Promise<AdminMetricsSnapshot> {
    const hit = this.cache.get(CACHE_KEY);
    if (hit && hit.expiresAt > now.getTime()) {
      return { ...hit.value, cached: true };
    }

    const fresh = await this.aggregate(now);
    this.cache.set(CACHE_KEY, {
      value: fresh,
      expiresAt: now.getTime() + this.ttlMs,
    });
    return fresh;
  }

  /** Testing seam: force next getSnapshot to miss cache. */
  clearCache(): void {
    this.cache.clear();
  }

  private async aggregate(now: Date): Promise<AdminMetricsSnapshot> {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      usersTotal,
      usersActive7d,
      simpleAlerts,
      rulesByType,
      receiptsParsed,
      receiptsFailed,
      alertsNotified,
      rulesNotified,
      familyBaskets,
    ] = await Promise.all([
      this.repo.countUsersActive(),
      this.repo.countDistinctActiveUsersSince(sevenDaysAgo),
      this.repo.countSimpleAlertsActive(),
      this.repo.countAlertRulesByType(),
      this.repo.countReceiptsByStatusSince('ready', thirtyDaysAgo),
      this.repo.countReceiptsByStatusSince('failed', thirtyDaysAgo),
      this.repo.countAlertsNotifiedSince(sevenDaysAgo),
      this.repo.countAlertRulesNotifiedSince(sevenDaysAgo),
      this.repo.countFamilyBasketsReadySince(sevenDaysAgo),
    ]);

    return {
      usersTotal,
      usersActive7d,
      alertsActiveByType: this.foldAlertsByType(simpleAlerts, rulesByType),
      receipts30d: { parsed: receiptsParsed, failed: receiptsFailed },
      pushNotifications7d: alertsNotified + rulesNotified,
      familyBasketsGenerated7d: familyBaskets,
      generatedAt: now.toISOString(),
      cached: false,
    };
  }

  private foldAlertsByType(
    simple: number,
    rulesByType: Array<{ type: string; count: number }>,
  ): AlertsActiveByType {
    const out: AlertsActiveByType = {
      simple,
      combo: 0,
      trend: 0,
      bundle: 0,
    };
    for (const row of rulesByType) {
      if ((KNOWN_RULE_TYPES as readonly string[]).includes(row.type)) {
        out[row.type as AlertRuleType] = row.count;
      } else {
        this.logger.warn(
          `AdminMetrics: ignoring unknown alert_rule.type=${row.type}`,
        );
      }
    }
    return out;
  }
}
