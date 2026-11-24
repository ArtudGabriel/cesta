"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { ProductCard } from "./product-card";
import { ProductCardSkeleton } from "./product-card-skeleton";
import { FilterBar } from "./filter-bar";
import { useCategories, useProducts } from "../hooks/use-catalog";
import { useFiltersStore } from "../stores/filters.store";
import {
  filtersFromSearchParams,
  filtersToSearchParams,
} from "../utils/filters-url";
import { useLocale } from "@/hooks/use-locale";

interface CategoriaClientProps {
  slug: string;
  initialSearchParams: Record<string, string>;
}

export function CategoriaClient({
  slug,
  initialSearchParams,
}: CategoriaClientProps) {
  const t = useTranslations("filters");
  const tCategories = useTranslations("categoryNames");
  const locale = useLocale();

  const filters = useFiltersStore((s) => s.filters);
  const applyPartial = useFiltersStore((s) => s.applyPartial);
  const resetAll = useFiltersStore((s) => s.resetAll);
  const hydratedRef = useRef(false);

  // Sprint 149: hidratação sync dos filtros via prop (não `useSearchParams`).
  // Zustand é mutado dentro do primeiro render client-side pra garantir
  // que `useProducts` receba `{category:slug, ...}` no mesmo frame —
  // elimina janela SSR→hydration onde S147/S148 caíram.
  if (!hydratedRef.current && typeof window !== "undefined") {
    hydratedRef.current = true;
    const params = new URLSearchParams(initialSearchParams);
    const parsed = filtersFromSearchParams(params);
    resetAll();
    applyPartial({ ...parsed, category: slug });
  }

  // Força fetch mesmo em SSR / primeiro paint: effectiveFilters sempre
  // inclui `category=slug`. Store serve a FilterBar; esta fonte vai
  // direto pro useProducts.
  const effectiveFilters = useMemo(
    () => ({ ...filters, category: slug }),
    [filters, slug],
  );

  // Sync URL no cliente após mudança de filtros (shareable links).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const { category: _omit, ...rest } = filters;
    const qs = filtersToSearchParams(rest).toString();
    const target = qs
      ? `${window.location.pathname}?${qs}`
      : window.location.pathname;
    window.history.replaceState(null, "", target);
  }, [filters]);

  const categoriesQ = useCategories();
  const categoryLabel = useMemo(() => {
    // 1) namespace i18n `categoryNames.<slug>`
    try {
      const i18n = tCategories(slug);
      if (i18n && i18n !== slug) return i18n;
    } catch {
      // key missing → próximo fallback
    }
    // 2) backend Category.nameEs/namePt
    const match = categoriesQ.data?.find((c) => c.slug === slug);
    if (match) return locale === "pt-BR" ? match.namePt : match.nameEs;
    // 3) slug cru
    return slug;
  }, [categoriesQ.data, slug, locale, tCategories]);

  const productsQ = useProducts(effectiveFilters);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-wide text-neutral-500">
          {t("breadcrumbCategory")}
        </p>
        <h1 className="text-2xl font-bold text-neutral-900">{categoryLabel}</h1>
        {productsQ.data?.meta.pagination && (
          <p className="text-sm text-neutral-500">
            {t("totalCount", { count: productsQ.data.meta.pagination.total })}
          </p>
        )}
      </header>

      <FilterBar hideCategory activeCategorySlug={slug} />

      <section aria-label={t("aria.productsList")}>
        {productsQ.isLoading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        )}
        {!productsQ.isLoading && productsQ.data?.items.length === 0 && (
          <div className="rounded-2xl bg-white p-8 text-center text-sm text-neutral-500 ring-1 ring-black/5">
            {t("empty")}
          </div>
        )}
        {!productsQ.isLoading &&
          productsQ.data &&
          productsQ.data.items.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {productsQ.data.items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
      </section>
    </main>
  );
}
