import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AlertRule } from '@prisma/client';
import { Job, Queue } from 'bullmq';
import { createHash } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AlertsRepository } from './alerts.repository';
import {
  AlertRulePayload,
  AlertRuleType,
  BundleRules,
  ComboRules,
  TrendRules,
  schemaFor,
} from './dtos/alert-rule.dto';

export const ALERT_RULE_EVAL_QUEUE = 'alert-rule-evaluator';
export type AlertRuleEvalJob = Record<string, never>;

/**
 * Sprint 105 cron 2h. Avalia AlertRule ativas (combo/trend/bundle) contra
 * ProductPrice/PriceSnapshot atual, enfileira push via S96 NotificationsService.
 * Idempotente via `lastNotifiedHash` (sha256 do stateSnapshot); só reenvia
 * quando o hash muda. Ver ADR-0005.
 */
@Processor(ALERT_RULE_EVAL_QUEUE)
export class AlertRuleEvaluatorProcessor
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(AlertRuleEvaluatorProcessor.name);

  constructor(
    private readonly repo: AlertsRepository,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    @InjectQueue(ALERT_RULE_EVAL_QUEUE)
    private readonly queue: Queue<AlertRuleEvalJob>,
  ) {
    super();
  }

  onModuleInit(): void {
    setImmediate(() => void this.scheduleCron());
  }

  private async scheduleCron(): Promise<void> {
    const enabled =
      this.config.get<string>('ALERT_RULE_EVAL_CRON_ENABLED', 'false') ===
      'true';
    if (!enabled) {
      this.logger.log(
        'AlertRuleEvaluator cron DISABLED via env (MVP $0/mês Redis quota)',
      );
      return;
    }
    const cron = this.config.get<string>('CRON_ALERT_RULE_EVAL', '15 */2 * * *');
    try {
      await this.queue.add(
        'rule-eval-scan',
        {},
        {
          jobId: 'cron-alert-rule-evaluator',
          repeat: { pattern: cron, tz: 'Europe/Madrid' },
          removeOnComplete: 50,
          removeOnFail: 50,
        },
      );
      this.logger.log(`AlertRuleEvaluator cron scheduled "${cron}"`);
    } catch (err) {
      this.logger.error(
        `AlertRuleEvaluator cron schedule failed: ${(err as Error).message}`,
      );
    }
  }

  async process(job: Job<AlertRuleEvalJob>): Promise<void> {
    if (job.name !== 'rule-eval-scan') return;
    const rules = await this.repo.findAllActiveRules();
    if (rules.length === 0) return;

    let notified = 0;
    for (const rule of rules) {
      try {
        const type = rule.type as AlertRuleType;
        const payload = this.parseRules(rule);
        if (!payload) continue;

        const outcome = await this.evaluate(type, payload);
        if (!outcome) continue;

        const hash = this.hashState(outcome.stateSnapshot);
        if (rule.lastNotifiedHash === hash) continue;

        await this.notifications.sendToUser(rule.userId, {
          title: outcome.title,
          body: outcome.body,
          tag: `alert-rule-${rule.id}`,
          data: { ruleId: rule.id, type, url: '/alertas' },
        });
        await this.repo.markRuleNotified(rule.id, hash, new Date());
        notified++;
      } catch (err) {
        this.logger.error(
          `Rule ${rule.id} evaluation failed: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `AlertRuleEvaluator scan: ${rules.length} ativas, ${notified} disparadas`,
    );
  }

  private parseRules(rule: AlertRule): AlertRulePayload | null {
    const type = rule.type as AlertRuleType;
    const schema = schemaFor(type);
    const parsed = schema.safeParse(rule.rules);
    if (!parsed.success) {
      this.logger.warn(
        `Rule ${rule.id} payload inválido (shape ${type}); skip`,
      );
      return null;
    }
    return parsed.data;
  }

  // ──────────────────────────────────────────────────────────────
  // Avaliadores por tipo (exposto pra testes via visibility public)
  // ──────────────────────────────────────────────────────────────

  async evaluate(
    type: AlertRuleType,
    rules: AlertRulePayload,
  ): Promise<{
    title: string;
    body: string;
    stateSnapshot: Record<string, unknown>;
  } | null> {
    switch (type) {
      case 'combo':
        return this.evaluateCombo(rules as ComboRules);
      case 'trend':
        return this.evaluateTrend(rules as TrendRules);
      case 'bundle':
        return this.evaluateBundle(rules as BundleRules);
    }
  }

  private async evaluateCombo(rules: ComboRules) {
    const prices = await this.prisma.productPrice.findMany({
      where: {
        productId: { in: rules.productIds },
        isAvailable: true,
      },
      orderBy: { currentPrice: 'asc' },
    });
    // Menor preço por productId (across mercados)
    const minByProduct = new Map<string, number>();
    for (const p of prices) {
      const cur = minByProduct.get(p.productId);
      const v = Number(p.currentPrice);
      if (cur == null || v < cur) minByProduct.set(p.productId, v);
    }
    // Cobertura: todo productId precisa ter preço
    if (minByProduct.size !== rules.productIds.length) return null;

    const total = Array.from(minByProduct.values()).reduce((a, b) => a + b, 0);
    if (total > rules.targetTotal) return null;

    return {
      title: '¡Combo dentro del presupuesto!',
      body: `Tu combo cuesta €${total.toFixed(2)} (objetivo €${rules.targetTotal.toFixed(2)})`,
      stateSnapshot: {
        kind: 'combo',
        total: Number(total.toFixed(2)),
        target: rules.targetTotal,
      },
    };
  }

  private async evaluateTrend(rules: TrendRules) {
    const weeks = rules.consecutiveWeeks;
    // Captura janelas semanais (weeks + 1 pontos pra calcular quedas)
    const now = new Date();
    const windowMs = 7 * 24 * 60 * 60 * 1000;
    const minima: number[] = [];
    for (let i = 0; i <= weeks; i++) {
      const to = new Date(now.getTime() - i * windowMs);
      const from = new Date(to.getTime() - windowMs);
      const row = await this.prisma.priceSnapshot.aggregate({
        where: {
          productId: rules.productId,
          capturedAt: { gte: from, lt: to },
        },
        _min: { price: true },
      });
      const min = row._min.price ? Number(row._min.price) : null;
      if (min == null) return null; // sem dado → não dispara
      minima.push(min);
    }
    // minima[0] = janela mais recente; minima[weeks] = mais antiga
    // queda consecutiva: minima[i] < minima[i+1] pra i in 0..weeks-1
    for (let i = 0; i < weeks; i++) {
      if (!(minima[i] < minima[i + 1])) return null;
    }
    const latest = minima[0];
    const oldest = minima[weeks];
    return {
      title: '📉 Tendencia de bajada',
      body: `Precio cayó ${weeks} semanas seguidas: €${oldest.toFixed(2)} → €${latest.toFixed(2)}`,
      stateSnapshot: {
        kind: 'trend',
        productId: rules.productId,
        minima: minima.map((m) => Number(m.toFixed(2))),
      },
    };
  }

  private async evaluateBundle(rules: BundleRules) {
    const prices = await this.prisma.productPrice.findMany({
      where: {
        productId: { in: rules.productIds },
        isAvailable: true,
      },
    });
    // Agrupa por supermarketId; pra cada mercado com cobertura total, soma
    const bySuper = new Map<string, Map<string, number>>();
    for (const p of prices) {
      if (!bySuper.has(p.supermarketId)) bySuper.set(p.supermarketId, new Map());
      bySuper
        .get(p.supermarketId)!
        .set(p.productId, Number(p.currentPrice));
    }
    const totals: Array<{ supermarketId: string; total: number }> = [];
    for (const [sid, m] of bySuper) {
      if (m.size !== rules.productIds.length) continue;
      const t = Array.from(m.values()).reduce((a, b) => a + b, 0);
      totals.push({ supermarketId: sid, total: t });
    }
    if (totals.length < 2) return null;
    totals.sort((a, b) => a.total - b.total);
    const cheapest = totals[0];
    const priciest = totals[totals.length - 1];
    const savings = priciest.total - cheapest.total;
    if (savings < rules.targetSavings) return null;
    return {
      title: '🧺 Ahorro detectado en tu bundle',
      body: `Economizá €${savings.toFixed(2)} comprando en el mercado más barato`,
      stateSnapshot: {
        kind: 'bundle',
        cheapest: cheapest.supermarketId,
        priciest: priciest.supermarketId,
        savings: Number(savings.toFixed(2)),
      },
    };
  }

  private hashState(state: Record<string, unknown>): string {
    return createHash('sha256').update(JSON.stringify(state)).digest('hex');
  }
}
