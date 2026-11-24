"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
}

export function CategoriaClient({ slug }: CategoriaClientProps) {
  const t = useTranslations("filters");
  const tCategories = useTranslations("categoryNames");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useFiltersStore((s) => s.filters);
  const applyPartial = useFiltersStore((s) => s.applyPartial);
  const resetAll = useFiltersStore((s) => s.resetAll);

  // Sprint 148 fix P0: hidrata store do URL antes do primeiro render
  // útil. `effectiveFilters` derivado cola `category=slug` mesmo quando
  // o store ainda não sincronizou — garante useProducts disparar fetch
  // na mount (sem esperar o useEffect de hidratação terminar).
  const effectiveFilters = useMemo(
    () => ({ ...filters, category: slug }),
    [filters, slug],
  );

  // Hidrata store a partir de URL + força category=slug da rota.
  useEffect(() => {
    const fromUrl = filtersFromSearchParams(searchParams);
    resetAll();
    applyPartial({ ...fromUrl, category: slug });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Espelha filtros atuais na URL (shareable links). Omite `category`
  // porque já está no path.
  useEffect(() => {
    const { category: _omit, ...rest } = filters;
    const params = filtersToSearchParams(rest);
    const qs = params.toString();
    const target = qs ? `${pathname}?${qs}` : pathname;
    router.replace(target, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const categoriesQ = useCategories();
  const categoryLabel = useMemo(() => {
    // Sprint 148: prefer i18n namespace (categoryNames.<slug>) para
    // garantir label traduzida mesmo sem Category table carregada.
    // Fallback: nameEs/namePt do backend; último fallback: slug raw.
    try {
      const i18n = tCategories(slug);
      if (i18n && i18n !== slug) return i18n;
    } catch {
      // key missing — fallback abaixo
    }
    const match = categoriesQ.data?.find((c) => c.slug === slug);
    if (!match) return slug;
    return locale === "pt-BR" ? match.namePt : match.nameEs;
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
