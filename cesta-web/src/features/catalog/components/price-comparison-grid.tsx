"use client";

import { Tag, AlertTriangle } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { formatUnitPrice } from "../utils/format-unit-price";
import { useLocale } from "../hooks/use-locale";
import type { PriceByMarket } from "../types/catalog.types";

interface PriceComparisonGridProps {
  prices: PriceByMarket[];
}

export function PriceComparisonGrid({ prices }: PriceComparisonGridProps) {
  const locale = useLocale();

  if (prices.length === 0) {
    return (
      <p className="text-sm text-muted">Sin precios disponibles por ahora.</p>
    );
  }

  const available = prices.filter((p) => p.isAvailable);
  const cheapest = available.length
    ? available.reduce((a, b) => (a.price < b.price ? a : b))
    : null;

  const sorted = [...prices].sort((a, b) => {
    if (!a.isAvailable && b.isAvailable) return 1;
    if (a.isAvailable && !b.isAvailable) return -1;
    return a.price - b.price;
  });

  return (
    <ul className="space-y-2">
      {sorted.map((p) => {
        const isCheapest = cheapest && p.supermarketSlug === cheapest.supermarketSlug;
        return (
          <li
            key={p.supermarketSlug}
            className={cn(
              "flex items-center gap-3 rounded-card border p-3",
              isCheapest ? "border-cesta-green bg-cesta-green/5" : "border-border bg-white",
              !p.isAvailable && "opacity-50",
            )}
          >
            <span
              className="h-10 w-10 flex-shrink-0 rounded-btn flex items-center justify-center text-xs font-bold text-white"
              style={{ backgroundColor: p.supermarketColor ?? "#1b6b48" }}
            >
              {p.supermarketName.slice(0, 2).toUpperCase()}
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{p.supermarketName}</p>
              <p className="text-xs text-muted">
                {formatUnitPrice(p.unitPrice, locale) ?? ""}
                {p.isStale && (
                  <span className="ml-2 inline-flex items-center gap-1 text-amber">
                    <AlertTriangle className="h-3 w-3" /> precio desactualizado
                  </span>
                )}
              </p>
            </div>

            <div className="flex flex-col items-end gap-1">
              {p.isAvailable ? (
                <>
                  <span
                    className={cn(
                      "text-lg font-bold",
                      isCheapest ? "text-cesta-green" : "text-ink",
                    )}
                  >
                    {formatPrice(p.price)}
                  </span>
                  {p.onPromotion && (
                    <span className="inline-flex items-center gap-1 rounded-pill bg-amber/20 px-2 py-0.5 text-[10px] font-medium text-amber">
                      <Tag className="h-3 w-3" /> Promo
                    </span>
                  )}
                </>
              ) : (
                <span className="text-xs text-muted">No disponible</span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
