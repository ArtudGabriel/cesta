"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { formatPrice } from "@/lib/utils";
import { useExpensesTopProducts } from "@/features/expenses/hooks/use-expenses";
import type { Period } from "@/features/expenses/types/expense.types";

interface Props {
  period: Period;
}

export function TopProductsCard({ period }: Props) {
  const t = useTranslations("expenses.dashboard.topProducts");
  const query = useExpensesTopProducts(period);

  if (query.isLoading) {
    return (
      <section data-sentry-mask data-testid="top-products-loading">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
          {t("title")}
        </h3>
        <ul className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <li
              key={i}
              className="h-14 animate-pulse rounded-card bg-neutral-200"
            />
          ))}
        </ul>
      </section>
    );
  }

  const items = query.data ?? [];
  if (items.length === 0) {
    return (
      <section data-sentry-mask>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
          {t("title")}
        </h3>
        <p
          className="rounded-card border border-dashed border-border bg-white/50 p-4 text-center text-sm text-muted"
          data-testid="top-products-empty"
        >
          {t("empty")}
        </p>
      </section>
    );
  }

  return (
    <section data-sentry-mask>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
        {t("title")}
      </h3>
      <ul className="space-y-2" data-testid="top-products-list">
        {items.map((p, idx) => {
          const content = (
            <div className="flex items-center gap-3 rounded-card bg-white p-3 shadow-card">
              <span className="font-display text-lg font-bold text-muted">
                {idx + 1}
              </span>
              <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-btn bg-neutral-100">
                {p.imageUrl ? (
                  <Image
                    src={p.imageUrl}
                    alt=""
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-medium text-ink">
                  {p.name}
                </p>
                <p className="text-xs text-muted">
                  {t("quantity", { count: p.quantity })}
                </p>
              </div>
              <span className="text-sm font-bold text-cesta-green">
                {formatPrice(p.total)}
              </span>
            </div>
          );
          return (
            <li
              key={p.productId ?? `raw-${idx}`}
              data-testid={`top-product-${idx}`}
            >
              {p.productId ? (
                <Link href={`/produto/${p.productId}`}>{content}</Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
