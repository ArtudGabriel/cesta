"use client";

import { AlertCircle, Check, Trophy, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn, formatPrice } from "@/lib/utils";
import { formatUnitPrice } from "../utils/format-unit-price";
import { useLocale } from "../hooks/use-locale";
import type { Product } from "../types/catalog.types";

export type SortMode = "absolute" | "unit";

interface CompareGridProps {
  products: Product[];
  onRemove: (productId: string) => void;
  sortMode?: SortMode;
}

export function CompareGrid({
  products,
  onRemove,
  sortMode = "absolute",
}: CompareGridProps) {
  const locale = useLocale();
  const t = useTranslations("compare");

  // Winner: menor métrica conforme modo. Modo 'unit' exclui produtos sem unitPrice.
  const eligibleForWinner = products.filter((p) => {
    if (sortMode === "absolute") return p.cheapestPrice != null;
    return p.cheapestUnitPrice != null;
  });
  const winnerId = eligibleForWinner
    .slice()
    .sort((a, b) => metric(a, sortMode) - metric(b, sortMode))[0]?.id;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {products.map((p) => (
          <ProductCompareCard
            key={p.id}
            product={p}
            isWinner={p.id === winnerId}
            onRemove={() => onRemove(p.id)}
            locale={locale}
            sortMode={sortMode}
          />
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-muted">
        {sortMode === "unit"
          ? t("normalizedNoteUnit")
          : t("normalizedNoteAbsolute")}
      </p>
    </>
  );
}

function metric(p: Product, mode: SortMode): number {
  if (mode === "unit") return p.cheapestUnitPrice?.value ?? Infinity;
  return p.cheapestPrice ?? Infinity;
}

function ProductCompareCard({
  product,
  isWinner,
  onRemove,
  locale,
  sortMode,
}: {
  product: Product;
  isWinner: boolean;
  onRemove: () => void;
  locale: "es" | "pt-BR";
  sortMode: SortMode;
}) {
  const cheapestSlug = product.cheapestSupermarketSlug;
  const unitPriceStr = formatUnitPrice(product.cheapestUnitPrice, locale);
  const noUnit = sortMode === "unit" && product.cheapestUnitPrice == null;
  const t = useTranslations("compare");
  const sortedPrices = [...product.prices].sort((a, b) => {
    if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
    return a.price - b.price;
  });

  return (
    <article className="relative rounded-card bg-white shadow-sm">
      <header className="flex items-start gap-3 p-4">
        <div className="h-16 w-16 flex-shrink-0 rounded-md bg-surface" />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold text-ink">
            {product.name}
          </h3>
          {product.brand && (
            <p className="mt-0.5 text-xs text-muted">{product.brand}</p>
          )}
          {product.cheapestPrice != null && (
            <>
              <p className="mt-2 text-lg font-bold text-cesta-green">
                {formatPrice(product.cheapestPrice)}
                <span className="ml-1 text-xs font-normal text-muted">
                  en{" "}
                  {
                    product.prices.find((p) => p.supermarketSlug === cheapestSlug)
                      ?.supermarketName
                  }
                </span>
              </p>
              {unitPriceStr && (
                <p className="text-sm text-muted">{unitPriceStr}</p>
              )}
            </>
          )}
          {noUnit && (
            <span className="mt-2 inline-flex items-center gap-1 rounded-pill bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-500">
              <AlertCircle className="h-3 w-3" /> {t("noUnitComparison")}
            </span>
          )}
          {isWinner && !noUnit && (
            <span className="mt-2 inline-flex items-center gap-1 rounded-pill bg-cesta-green/10 px-2 py-0.5 text-[11px] font-semibold text-cesta-green">
              <Trophy className="h-3 w-3" /> {t("winnerBadge")}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Quitar producto de la comparación"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
        {sortedPrices.map((price) => {
          const isCheapest = price.supermarketSlug === cheapestSlug;
          return (
            <li
              key={price.supermarketId}
              className={cn(
                "flex items-center justify-between px-4 py-2 text-sm",
                !price.isAvailable && "opacity-50",
              )}
            >
              <span
                className="inline-flex items-center gap-2 font-medium"
                style={{ color: price.supermarketColor ?? "#1b6b48" }}
              >
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-pill"
                  style={{ backgroundColor: price.supermarketColor ?? "#1b6b48" }}
                />
                <span className="text-ink">{price.supermarketName}</span>
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  isCheapest && price.isAvailable && "font-bold text-cesta-green",
                  !price.isAvailable && "line-through",
                )}
              >
                {isCheapest && price.isAvailable && (
                  <Check className="h-4 w-4" />
                )}
                {price.isAvailable ? formatPrice(price.price) : "Sin stock"}
              </span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
