"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn, formatPrice } from "@/lib/utils";
import {
  useExpenseSummary,
  useExpensesByCategory,
  useExpensesBySupermarket,
} from "../hooks/use-expenses";
import type { Period } from "../types/expense.types";

export function ExpenseDashboard() {
  const t = useTranslations("expenses.dashboard");
  const [period, setPeriod] = useState<Period>("month");
  const summary = useExpenseSummary(period);
  const byCategory = useExpensesByCategory(period);
  const bySupermarket = useExpensesBySupermarket(period);

  const periods: Array<{ value: Period; labelKey: "day" | "week" | "month" }> = [
    { value: "day", labelKey: "day" },
    { value: "week", labelKey: "week" },
    { value: "month", labelKey: "month" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 rounded-pill bg-surface p-1">
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={cn(
              "flex-1 rounded-pill py-2 text-sm font-medium cursor-pointer",
              period === p.value
                ? "bg-cesta-green text-white"
                : "text-muted hover:text-ink",
            )}
          >
            {t(`period.${p.labelKey}`)}
          </button>
        ))}
      </div>

      {summary.data && (
        <div className="rounded-card bg-cesta-green p-4 text-white">
          <p className="text-xs opacity-80">{t("totalSpent")}</p>
          <p className="font-display text-3xl font-extrabold">
            {formatPrice(summary.data.total)}
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs opacity-80">
            <span>{t("purchasesCount", { count: summary.data.count })}</span>
            {summary.data.previousTotal > 0 && (
              <span className="inline-flex items-center gap-1">
                {summary.data.deltaPct >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {t("deltaVsPrevious", { pct: Math.abs(summary.data.deltaPct) })}
              </span>
            )}
          </div>
        </div>
      )}

      {byCategory.data && byCategory.data.length > 0 && (
        <BucketList title={t("byCategory")} buckets={byCategory.data} />
      )}
      {bySupermarket.data && bySupermarket.data.length > 0 && (
        <BucketList title={t("bySupermarket")} buckets={bySupermarket.data} />
      )}
    </div>
  );
}

function BucketList({
  title,
  buckets,
}: {
  title: string;
  buckets: Array<{ label: string; total: number; count: number }>;
}) {
  const max = Math.max(...buckets.map((b) => b.total), 1);
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
        {title}
      </h3>
      <ul className="space-y-2">
        {buckets.map((b) => {
          const pct = (b.total / max) * 100;
          return (
            <li key={b.label} className="rounded-card bg-white p-3 shadow-card">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-ink">{b.label}</span>
                <span className="font-bold text-cesta-green">
                  {formatPrice(b.total)}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-pill bg-surface">
                <div
                  className="h-full bg-cesta-green"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
