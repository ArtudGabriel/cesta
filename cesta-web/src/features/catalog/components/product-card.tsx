"use client";

import Link from "next/link";
import { Tag } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { FavoriteToggle } from "@/features/favorites/components/favorite-toggle";
import { formatUnitPrice } from "../utils/format-unit-price";
import { useLocale } from "../hooks/use-locale";
import { HighlightedText } from "./highlighted-text";
import { NutriScoreBadge } from "./nutri-score-badge";
import type { Product } from "../types/catalog.types";

interface ProductCardProps {
  product: Product;
  className?: string;
  sortMode?: "absolute" | "unit";
  highlight?: string;
}

export function ProductCard({
  product,
  className,
  sortMode = "absolute",
  highlight,
}: ProductCardProps) {
  const locale = useLocale();
  const cheapest = product.prices.find(
    (p) => p.supermarketSlug === product.cheapestSupermarketSlug,
  );
  const unitPriceStr = formatUnitPrice(product.cheapestUnitPrice, locale);
  const unitPrimary = sortMode === "unit" && unitPriceStr != null;

  return (
    // Sprint 59 GDPR: card inteiro é catálogo público (nome + preço + marca).
    // data-sentry-unmask no root permite diagnose Sentry Replay sem vazar PII.
    <div className="relative" data-sentry-unmask>
      <Link
        href={`/produto/${product.id}`}
        className={cn(
          "group block rounded-card bg-white p-4 shadow-card transition-shadow hover:shadow-card-elevated",
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <div className="relative h-16 w-16 flex-shrink-0 rounded-btn bg-surface">
            {product.nutriScore && (
              <div className="absolute left-1 top-1 rounded-md bg-white/80 p-0.5 backdrop-blur-sm">
                <NutriScoreBadge grade={product.nutriScore.grade} size="sm" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 pr-10" data-sentry-unmask>
            <h3 className="line-clamp-2 text-sm font-medium text-ink group-hover:text-cesta-green">
              <HighlightedText text={product.name} highlight={highlight} />
            </h3>
            {product.brand && (
              <p className="mt-0.5 text-xs text-muted">{product.brand}</p>
            )}
            {cheapest && (
              <>
                <div className="mt-2 flex items-baseline gap-2">
                  {unitPrimary ? (
                    <>
                      <span className="text-lg font-bold text-ink">
                        {unitPriceStr}
                      </span>
                      <span className="text-xs text-muted">
                        {formatPrice(cheapest.price)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-lg font-bold text-ink">
                        {formatPrice(cheapest.price)}
                      </span>
                      {unitPriceStr && (
                        <span className="text-xs text-muted">{unitPriceStr}</span>
                      )}
                    </>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className="rounded-pill px-2 py-0.5 text-[10px] font-medium text-white"
                    style={{
                      backgroundColor: cheapest.supermarketColor ?? "#1b6b48",
                    }}
                  >
                    {cheapest.supermarketName}
                  </span>
                  {cheapest.onPromotion && (
                    <span className="flex items-center gap-1 rounded-pill bg-lima/20 px-2 py-0.5 text-[10px] font-medium text-cesta-green-dark">
                      <Tag className="h-3 w-3" /> Promo
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </Link>
      <div className="absolute right-3 top-3 z-10">
        <FavoriteToggle productId={product.id} size="sm" returnUrl="/" />
      </div>
    </div>
  );
}
