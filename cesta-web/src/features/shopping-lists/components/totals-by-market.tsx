"use client";

import { Check, Minus, TrendingDown } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import type { ListTotals } from "../types/shopping-list.types";

interface TotalsByMarketProps {
  totals: ListTotals;
}

export function TotalsByMarket({ totals }: TotalsByMarketProps) {
  if (totals.bySupermarket.length === 0) {
    return (
      <p className="text-sm text-muted">
        Agrega productos para ver el total en cada supermercado.
      </p>
    );
  }

  const sorted = [...totals.bySupermarket].sort((a, b) => {
    // disponíveis completos primeiro, depois incompletos
    if (a.missingItems !== b.missingItems) {
      return a.missingItems - b.missingItems;
    }
    return a.total - b.total;
  });

  return (
    <div className="space-y-2">
      {sorted.map((t) => {
        const isCheapest = t.supermarketSlug === totals.cheapestSupermarketSlug;
        const isComplete = t.missingItems === 0;
        return (
          <div
            key={t.supermarketSlug}
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
              style={{ backgroundColor: t.supermarketColor ?? "#1b6b48" }}
            >
              {t.supermarketName.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{t.supermarketName}</p>
              <p className="text-xs text-muted">
                {isComplete ? (
                  <span className="inline-flex items-center gap-1 text-cesta-green">
                    <Check className="h-3 w-3" />
                    {t.availableItems} productos
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber">
                    <Minus className="h-3 w-3" />
                    Faltan {t.missingItems} productos
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
              {formatPrice(t.total)}
            </span>
          </div>
        );
      })}

      {totals.hybridItems.length > 0 && totals.cheapestTotal !== null && (
        <div className="mt-4 rounded-card border border-violet bg-violet/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-5 w-5 text-violet" />
            <h4 className="font-display font-bold text-ink">Lista híbrida</h4>
          </div>
          <p className="text-xs text-muted mb-3">
            Comprar cada producto en el supermercado más barato
          </p>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted">Total híbrido</span>
            <span className="text-xl font-extrabold text-violet">
              {formatPrice(totals.hybridTotal)}
            </span>
          </div>
          {totals.hybridSavings > 0 && (
            <p className="mt-2 text-xs text-cesta-green">
              Ahorras {formatPrice(totals.hybridSavings)} vs el supermercado
              más barato ({totals.cheapestSupermarketSlug})
            </p>
          )}
        </div>
      )}
    </div>
  );
}
