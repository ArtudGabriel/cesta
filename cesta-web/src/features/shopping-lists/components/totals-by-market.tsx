"use client";

import { Check, Minus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn, formatPrice } from "@/lib/utils";
import { SupermarketBadge } from "@/features/catalog/components/supermarket-badge";
import type { ListTotals } from "../types/shopping-list.types";

interface TotalsByMarketProps {
  totals: ListTotals;
}

export function TotalsByMarket({ totals }: TotalsByMarketProps) {
  const t = useTranslations("myList.totals");

  if (totals.bySupermarket.length === 0) {
    return <p className="text-sm text-muted">{t("empty")}</p>;
  }

  const sorted = [...totals.bySupermarket].sort((a, b) => {
    if (a.missingItems !== b.missingItems) {
      return a.missingItems - b.missingItems;
    }
    return a.total - b.total;
  });

  // Sprint 163 — most-expensive só destaca se houver ≥2 markets complete;
  // evita colorir único market coral só por ser o único.
  const completeMarkets = sorted.filter((m) => m.missingItems === 0);
  const mostExpensiveSlug =
    completeMarkets.length >= 2
      ? completeMarkets[completeMarkets.length - 1].supermarketSlug
      : null;

  return (
    <div className="space-y-2">
      {sorted.map((market) => {
        const isCheapest =
          market.supermarketSlug === totals.cheapestSupermarketSlug;
        const isMostExpensive = market.supermarketSlug === mostExpensiveSlug;
        const isComplete = market.missingItems === 0;
        return (
          <div
            key={market.supermarketSlug}
            className={cn(
              "flex items-center gap-3 rounded-card border p-3",
              isCheapest
                ? "border-cesta-green bg-cesta-green/5"
                : isMostExpensive
                  ? "border-coral bg-coral/5"
                  : "border-border bg-white",
              !isComplete && "opacity-70",
            )}
            data-testid={`totals-market-${market.supermarketSlug}`}
          >
            <SupermarketBadge
              slug={market.supermarketSlug}
              name={market.supermarketName}
              color={market.supermarketColor}
              size={40}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">
                {market.supermarketName}
              </p>
              <p className="text-xs text-muted">
                {isComplete ? (
                  <span className="inline-flex items-center gap-1 text-cesta-green">
                    <Check className="h-3 w-3" />
                    {t("availableCount", { count: market.availableItems })}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber">
                    <Minus className="h-3 w-3" />
                    {t("missingCount", { count: market.missingItems })}
                  </span>
                )}
              </p>
            </div>
            <span
              className={cn(
                "text-lg font-bold",
                isCheapest
                  ? "text-cesta-green"
                  : isMostExpensive
                    ? "text-coral"
                    : "text-ink",
              )}
            >
              {formatPrice(market.total)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
