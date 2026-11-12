import { Injectable } from '@nestjs/common';
import { ExpensesRepository } from './expenses.repository';

export type Period = 'day' | 'week' | 'month';

export interface ExpenseSummary {
  period: Period;
  from: Date;
  to: Date;
  total: number;
  count: number;
  previousTotal: number;
  deltaPct: number;
}

export interface ExpenseBucket {
  label: string;
  total: number;
  count: number;
}

@Injectable()
export class ExpensesService {
  constructor(private readonly repo: ExpensesRepository) {}

  async summary(userId: string, period: Period): Promise<ExpenseSummary> {
    const now = new Date();
    const { from, to } = rangeFor(period, now);
    const prev = rangeFor(period, new Date(from.getTime() - 1));

    const [current, previous] = await Promise.all([
      this.repo.aggregateReceiptTotals(userId, from, to),
      this.repo.aggregateReceiptTotals(userId, prev.from, prev.to),
    ]);

    const total = current.sum;
    const previousTotal = previous.sum;
    const deltaPct =
      previousTotal > 0
        ? Math.round(((total - previousTotal) / previousTotal) * 1000) / 10
        : 0;

    return {
      period,
      from,
      to,
      total: Math.round(total * 100) / 100,
      count: current.count,
      previousTotal: Math.round(previousTotal * 100) / 100,
      deltaPct,
    };
  }

  async byCategory(userId: string, period: Period): Promise<ExpenseBucket[]> {
    const { from, to } = rangeFor(period, new Date());
    const items = await this.repo.findItemsForCategoryBreakdown(userId, from, to);

    const buckets = new Map<string, { total: number; count: number }>();
    for (const item of items) {
      const label = item.categoryName ?? 'Sin categoría';
      const entry = buckets.get(label) ?? { total: 0, count: 0 };
      entry.total += item.total;
      entry.count += 1;
      buckets.set(label, entry);
    }

    return [...buckets.entries()]
      .map(([label, v]) => ({
        label,
        total: Math.round(v.total * 100) / 100,
        count: v.count,
      }))
      .sort((a, b) => b.total - a.total);
  }

  async bySupermarket(userId: string, period: Period): Promise<ExpenseBucket[]> {
    const { from, to } = rangeFor(period, new Date());
    const receipts = await this.repo.findReceiptsForMarketBreakdown(
      userId,
      from,
      to,
    );

    const buckets = new Map<string, { total: number; count: number }>();
    for (const r of receipts) {
      const label = r.marketName ?? r.marketSlug ?? 'Desconocido';
      const entry = buckets.get(label) ?? { total: 0, count: 0 };
      entry.total += r.total;
      entry.count += 1;
      buckets.set(label, entry);
    }

    return [...buckets.entries()]
      .map(([label, v]) => ({
        label,
        total: Math.round(v.total * 100) / 100,
        count: v.count,
      }))
      .sort((a, b) => b.total - a.total);
  }
}

function rangeFor(period: Period, ref: Date): { from: Date; to: Date } {
  const to = new Date(ref);
  const from = new Date(ref);
  switch (period) {
    case 'day':
      from.setUTCHours(0, 0, 0, 0);
      to.setUTCHours(23, 59, 59, 999);
      break;
    case 'week': {
      const dow = from.getUTCDay();
      const diff = (dow + 6) % 7;
      from.setUTCDate(from.getUTCDate() - diff);
      from.setUTCHours(0, 0, 0, 0);
      to.setTime(from.getTime() + 6 * 24 * 60 * 60 * 1000);
      to.setUTCHours(23, 59, 59, 999);
      break;
    }
    case 'month':
      from.setUTCDate(1);
      from.setUTCHours(0, 0, 0, 0);
      to.setUTCMonth(from.getUTCMonth() + 1);
      to.setUTCDate(0);
      to.setUTCHours(23, 59, 59, 999);
      break;
  }
  return { from, to };
}
