"use client";

import { ArrowDown, ArrowUp, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useLocale } from "@/hooks/use-locale";
import { cn, formatPrice } from "@/lib/utils";
import { formatUnitPrice } from "../utils/format-unit-price";
import type { PriceByMarket, Product } from "../types/catalog.types";

interface CompareMatrixProps {
  products: Product[];
  onRemove: (productId: string) => void;
}

type SortDir = "asc" | "desc";

interface SupermarketCol {
  supermarketId: string;
  supermarketSlug: string;
  supermarketName: string;
  supermarketColor: string | null;
  avgPrice: number;
}

/**
 * Sprint 131: tabela cross matriz produtos × supermarkets.
 * - Produtos linha, supermarkets coluna
 * - Supermarkets ordenados ASC pelo preço médio nos produtos selecionados
 * - Célula cheapest por produto destacada verde cesta
 * - Mobile: horizontal scroll (overflow-x-auto)
 */
export function CompareMatrix({ products, onRemove }: CompareMatrixProps) {
  const t = useTranslations("compare");
  const locale = useLocale();
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const columns = useMemo<SupermarketCol[]>(() => {
    const perSuper = new Map<
      string,
      { col: SupermarketCol; prices: number[] }
    >();
    for (const product of products) {
      for (const price of product.prices) {
        if (!price.isAvailable) continue;
        let entry = perSuper.get(price.supermarketSlug);
        if (!entry) {
          entry = {
            col: {
              supermarketId: price.supermarketId,
              supermarketSlug: price.supermarketSlug,
              supermarketName: price.supermarketName,
              supermarketColor: price.supermarketColor,
              avgPrice: 0,
            },
            prices: [],
          };
          perSuper.set(price.supermarketSlug, entry);
        }
        entry.prices.push(price.price);
      }
    }
    const base = [...perSuper.values()].map(({ col, prices }) => ({
      ...col,
      avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
    }));
    return base.sort((a, b) =>
      sortDir === "asc" ? a.avgPrice - b.avgPrice : b.avgPrice - a.avgPrice,
    );
  }, [products, sortDir]);

  if (products.length === 0) return null;
  if (columns.length === 0) {
    return (
      <p
        className="rounded-card bg-white px-4 py-6 text-center text-sm text-muted shadow-sm"
        data-testid="compare-matrix-empty"
      >
        {t("matrixNoPrices")}
      </p>
    );
  }

  return (
    <div
      className="overflow-x-auto rounded-card border border-border bg-white shadow-sm"
      data-testid="compare-matrix"
    >
      <div className="flex items-center justify-end px-3 pt-2">
        <button
          type="button"
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          className="inline-flex items-center gap-1 rounded-btn border border-border bg-white px-2 py-1 text-xs text-ink hover:bg-neutral-50 cursor-pointer"
          aria-label={
            sortDir === "asc" ? t("matrixSortAsc") : t("matrixSortDesc")
          }
          data-testid="compare-matrix-sort-toggle"
        >
          {sortDir === "asc" ? (
            <ArrowUp className="h-3 w-3" aria-hidden />
          ) : (
            <ArrowDown className="h-3 w-3" aria-hidden />
          )}
          <span>
            {sortDir === "asc" ? t("matrixSortAsc") : t("matrixSortDesc")}
          </span>
        </button>
      </div>
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-neutral-50">
            <th
              scope="col"
              className="sticky left-0 z-10 min-w-[180px] bg-neutral-50 px-3 py-2 text-left font-display text-xs font-bold uppercase tracking-wider text-muted"
            >
              {t("matrixProductHeader")}
            </th>
            {columns.map((col) => (
              <th
                key={col.supermarketSlug}
                scope="col"
                className="whitespace-nowrap px-3 py-2 text-right font-display text-xs font-bold text-ink"
                data-testid={`compare-matrix-col-${col.supermarketSlug}`}
              >
                <span
                  className="inline-flex h-5 items-center rounded-pill px-2 text-[10px] font-bold text-white"
                  style={{
                    backgroundColor:
                      col.supermarketColor ?? "var(--color-cesta-green)",
                  }}
                >
                  {col.supermarketName}
                </span>
              </th>
            ))}
            <th scope="col" className="w-10 px-2 py-2" aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const cheapest = cheapestPriceFor(product);
            return (
              <tr
                key={product.id}
                className="border-b border-border last:border-b-0"
                data-testid={`compare-matrix-row-${product.id}`}
              >
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-white px-3 py-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    {product.imageUrl ? (
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        width={32}
                        height={32}
                        className="h-8 w-8 flex-shrink-0 rounded-btn object-cover"
                      />
                    ) : (
                      <div className="h-8 w-8 flex-shrink-0 rounded-btn bg-neutral-100" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-ink">
                        {product.name}
                      </p>
                      {product.brand && (
                        <p className="truncate text-[10px] text-muted">
                          {product.brand}
                        </p>
                      )}
                    </div>
                  </div>
                </th>
                {columns.map((col) => {
                  const price = product.prices.find(
                    (p) => p.supermarketSlug === col.supermarketSlug,
                  );
                  const isCheapest =
                    price !== undefined &&
                    cheapest !== null &&
                    price.supermarketSlug === cheapest.supermarketSlug;
                  const unit = price?.unitPrice
                    ? formatUnitPrice(price.unitPrice, locale)
                    : null;
                  return (
                    <td
                      key={col.supermarketSlug}
                      className={cn(
                        "whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums",
                        // Sprint 174 fix: Lima (§3.3 "preço mais barato Lima #7DC95E").
                        // Antes usava cesta-green/10 — brand primary mas semântica
                        // de "ganho" em §3.3 é Lima. fg cesta-green mantido pra
                        // legibilidade (lima claro em bg lima/15 teria contraste baixo).
                        isCheapest &&
                          "bg-lima/15 font-bold text-cesta-green",
                        price && !price.isAvailable && "text-muted line-through",
                      )}
                      data-testid={`compare-matrix-cell-${product.id}-${col.supermarketSlug}`}
                      data-cheapest={isCheapest ? "true" : undefined}
                    >
                      {price ? (
                        <div className="flex flex-col items-end leading-tight">
                          <span>{formatPrice(price.price)}</span>
                          {unit && (
                            <span
                              className="text-[10px] font-normal text-muted"
                              data-testid={`compare-matrix-cell-unit-${product.id}-${col.supermarketSlug}`}
                            >
                              {unit}
                            </span>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                  );
                })}
                <td className="w-10 px-2 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onRemove(product.id)}
                    aria-label={t("remove")}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-pill text-muted hover:bg-neutral-100 hover:text-ink"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function cheapestPriceFor(product: Product): PriceByMarket | null {
  const available = product.prices.filter((p) => p.isAvailable);
  if (available.length === 0) return null;
  return available.reduce((a, b) => (a.price < b.price ? a : b));
}
