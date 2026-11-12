"use client";

import { Check, Minus, TrendingDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn, formatPrice } from "@/lib/utils";
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

  return (
    <div className="space-y-2">
      {sorted.map((market) => {
        const isCheapest =
          market.supermarketSlug === totals.cheapestSupermarketSlug;
        const isComplete = market.missingItems === 0;
        return (
          <div
            key={market.supermarketSlug}
            className={cn(
              "flex items-center gap-3 rounded-card border p-3",
              isCheapest
                ? "border-cesta-green bg-cesta-green/5"
                : "border-border bg-white",
              !isComplete && "opacity-70",
            )}
          >
            <span
              className="h-10 w-10 flex-shrink-0 rounded-btn flex items-center justify-center text-xs font-bold text-white"
              style={{ backgroundColor: market.supermarketColor ?? "#1b6b48" }}
            >
              {market.supermarketName.slice(0, 2).toUpperCase()}
            </span>
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
                isCheapest ? "text-cesta-green" : "text-ink",
              )}
            >
              {formatPrice(market.total)}
            </span>
          </div>
        );
      })}

      {totals.hybridItems.length > 0 && totals.cheapestTotal !== null && (
        <div className="mt-4 rounded-card border border-violet bg-violet/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-5 w-5 text-violet" />
            <h4 className="font-display font-bold text-ink">
              {t("hybridTitle")}
            </h4>
          </div>
          <p className="text-xs text-muted mb-3">{t("hybridSubtitle")}</p>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted">{t("hybridTotal")}</span>
            <span className="text-xl font-extrabold text-violet">
              {formatPrice(totals.hybridTotal)}
            </span>
          </div>
          {totals.hybridSavings > 0 && (
            <p className="mt-2 text-xs text-cesta-green">
              {t("hybridSavings", {
                amount: formatPrice(totals.hybridSavings),
                market: totals.cheapestSupermarketSlug ?? "",
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
