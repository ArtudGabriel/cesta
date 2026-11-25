"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useCategories } from "@/features/catalog/hooks/use-catalog";
import { useLocale } from "@/hooks/use-locale";
import { formatPrice } from "@/lib/utils";
import type { BasketItem } from "@/features/family-basket/types/family-basket.types";

interface Props {
  items: BasketItem[];
  renderItem: (item: BasketItem) => React.ReactNode;
}

/**
 * Sprint 173 — agrupa BasketItems por categoria (cesta.md §3.7.2 "Lista
 * produtos por categoria"). Resolve name via useCategories (cached 1h,
 * staleTime REFERENCE). Items sem categoryId OU sem match → bucket "Otros"
 * (fallback i18n).
 *
 * Ordem: categorias com items mais caros primeiro (subtotal DESC) — dá
 * visibilidade pro que pesa mais no custo total.
 */
export function BasketCategoryGroups({ items, renderItem }: Props) {
  const { data: categories } = useCategories();
  const locale = useLocale();
  const t = useTranslations("familyBasket");

  const groups = useMemo(() => {
    const byId = new Map<
      string,
      { id: string; label: string; items: BasketItem[]; total: number }
    >();

    for (const item of items) {
      const catId = item.product.categoryId ?? "__other__";
      const cat = categories?.find((c) => c.id === catId);
      const label = cat
        ? locale === "pt-BR"
          ? cat.namePt
          : cat.nameEs
        : t("categoryFallback");
      const entry = byId.get(catId) ?? {
        id: catId,
        label,
        items: [],
        total: 0,
      };
      entry.items.push(item);
      entry.total += item.subtotal;
      byId.set(catId, entry);
    }

    return [...byId.values()].sort((a, b) => b.total - a.total);
  }, [items, categories, locale, t]);

  return (
    <div className="space-y-5" data-testid="basket-category-groups">
      {groups.map((group) => (
        <section
          key={group.id}
          data-testid={`basket-category-group-${group.id}`}
        >
          <header className="mb-2 flex items-baseline justify-between">
            <h3
              className="text-xs font-semibold uppercase tracking-wide text-muted"
              data-sentry-unmask
            >
              {group.label}
            </h3>
            <span className="text-xs font-medium text-cesta-green">
              {formatPrice(group.total)}
            </span>
          </header>
          <ul className="space-y-2">
            {group.items.map((item) => (
              <li key={item.id}>{renderItem(item)}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
