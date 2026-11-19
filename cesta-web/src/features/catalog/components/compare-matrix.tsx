"use client";

import { X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { cn, formatPrice } from "@/lib/utils";
import type { PriceByMarket, Product } from "../types/catalog.types";

interface CompareMatrixProps {
  products: Product[];
  onRemove: (productId: string) => void;
}

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
    return [...perSuper.values()]
      .map(({ col, prices }) => ({
        ...col,
        avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
      }))
      .sort((a, b) => a.avgPrice - b.avgPrice);
  }, [products]);

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
                  return (
                    <td
                      key={col.supermarketSlug}
                      className={cn(
                        "whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums",
                        isCheapest &&
                          "bg-cesta-green/10 font-bold text-cesta-green",
                        price && !price.isAvailable && "text-muted line-through",
                      )}
                      data-testid={`compare-matrix-cell-${product.id}-${col.supermarketSlug}`}
                      data-cheapest={isCheapest ? "true" : undefined}
                    >
                      {price ? formatPrice(price.price) : "—"}
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
