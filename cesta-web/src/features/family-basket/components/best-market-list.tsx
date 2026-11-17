"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import type { BasketItem } from "../types/family-basket.types";
import { formatPrice } from "@/lib/utils";

interface BestMarketListProps {
  items: BasketItem[];
}

interface MarketTotal {
  slug: string;
  name: string;
  color: string | null;
  total: number;
  coverage: number;
}

export function BestMarketList({ items }: BestMarketListProps) {
  const t = useTranslations("familyBasket");

  const totals = useMemo<MarketTotal[]>(() => {
    const byMarket = new Map<string, MarketTotal>();
    for (const item of items) {
      const markets = item.product.prices ?? [];
      for (const price of markets) {
        if (!price.isAvailable) continue;
        const key = price.supermarketSlug;
        const existing = byMarket.get(key) ?? {
          slug: price.supermarketSlug,
          name: price.supermarketName,
          color: price.supermarketColor,
          total: 0,
          coverage: 0,
        };
        existing.total += price.price * item.quantity;
        existing.coverage += 1;
        byMarket.set(key, existing);
      }
    }
    return [...byMarket.values()].sort((a, b) => a.total - b.total);
  }, [items]);

  if (totals.length === 0) return null;

  return (
    <section className="px-4 py-4" data-sentry-unmask>
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">
        {t("bestMarketTitle")}
      </h2>
      <p className="mb-3 text-xs text-muted">{t("bestMarketSubtitle")}</p>
      <ul className="space-y-2">
        {totals.map((m, idx) => (
          <li
            key={m.slug}
            className="flex items-center justify-between rounded-card bg-white p-3 shadow-card"
          >
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-sm font-medium text-ink">
                {m.name}
              </p>
              <p className="text-xs text-muted">
                {t("bestMarketItemsCount", { count: m.coverage })}
              </p>
            </div>
            <div
              className={`text-right font-display text-lg font-bold ${
                idx === 0 ? "text-cesta-green" : "text-ink"
              }`}
            >
              {formatPrice(m.total)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
