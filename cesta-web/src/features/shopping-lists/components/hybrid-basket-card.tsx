"use client";

import { Sparkles, TrendingDown } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { formatPrice } from "@/lib/utils";
import type { ListTotals } from "../types/shopping-list.types";

interface HybridBasketCardProps {
  totals: ListTotals;
}

export function HybridBasketCard({ totals }: HybridBasketCardProps) {
  const t = useTranslations("myList.totals");

  if (totals.hybridItems.length === 0 || totals.cheapestTotal === null) {
    return null;
  }

  const cheapestMarket = totals.bySupermarket.find(
    (m) => m.supermarketSlug === totals.cheapestSupermarketSlug,
  );

  return (
    <section
      className="rounded-card border border-violet bg-violet/5 p-4"
      data-testid="hybrid-basket-card"
      data-sentry-mask
    >
      <header className="mb-3 flex items-center gap-2">
        <TrendingDown className="h-5 w-5 text-violet" />
        <h4 className="font-display font-bold text-ink">{t("hybridTitle")}</h4>
      </header>

      <p className="mb-4 text-xs text-muted">{t("hybridSubtitle")}</p>

      <ul className="mb-4 space-y-2" data-testid="hybrid-items-list">
        {totals.hybridItems.map((item) => (
          <li
            key={item.productId}
            className="rounded-card bg-white p-3 shadow-sm"
            data-testid={`hybrid-item-${item.productId}`}
          >
            <Link
              href={`/produto/${item.productId}`}
              className="flex items-center gap-3"
            >
              <span
                className="h-8 w-8 flex-shrink-0 rounded-btn flex items-center justify-center text-[10px] font-bold text-white"
                style={{
                  backgroundColor:
                    item.supermarketColor ?? "var(--color-cesta-green)",
                }}
                aria-hidden="true"
              >
                {item.supermarketName.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-medium text-ink">
                  {item.productName}
                </p>
                <p className="text-xs text-muted">
                  {item.supermarketName}
                  {item.quantity !== 1 && (
                    <span className="ml-2">× {item.quantity}</span>
                  )}
                  {item.onPromotion && (
                    <span
                      className="ml-2 inline-flex items-center gap-0.5 rounded-pill bg-cesta-green/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cesta-green"
                      data-testid={`hybrid-item-promo-${item.productId}`}
                    >
                      <Sparkles className="h-2.5 w-2.5" />
                      {t("hybridPromoBadge")}
                    </span>
                  )}
                </p>
              </div>
              <span className="text-sm font-bold text-cesta-green">
                {formatPrice(item.subtotal)}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="flex items-baseline justify-between border-t border-violet/20 pt-3">
        <span className="text-sm text-muted">{t("hybridTotal")}</span>
        <span
          className="text-xl font-extrabold text-violet"
          data-testid="hybrid-total"
        >
          {formatPrice(totals.hybridTotal)}
        </span>
      </div>

      {totals.hybridSavings > 0 && (
        <p
          className="mt-2 text-xs text-cesta-green"
          data-testid="hybrid-savings"
        >
          {t("hybridSavings", {
            amount: formatPrice(totals.hybridSavings),
            market: cheapestMarket?.supermarketName ?? totals.cheapestSupermarketSlug ?? "",
          })}
        </p>
      )}
    </section>
  );
}
