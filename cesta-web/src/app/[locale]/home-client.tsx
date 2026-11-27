"use client";

import Link from "next/link";
import { Bell, Receipt, ShoppingBasket } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ColdStartHint } from "@/components/cold-start-hint";
import { CategoryChipSkeleton } from "@/features/catalog/components/category-chip-skeleton";
import { DietaryFilters, type DietaryFlag } from "@/features/catalog/components/dietary-filters";
import { FeaturedDeals } from "@/features/catalog/components/featured-deals";
import { HomeEmptyState } from "@/features/catalog/components/home-empty-state";
import {
  NutriFilters,
  isHealthyGrade,
  nutriSortValue,
} from "@/features/catalog/components/nutri-filters";
import { ProductCard } from "@/features/catalog/components/product-card";
import { ProductCardSkeleton } from "@/features/catalog/components/product-card-skeleton";
import { SearchBar } from "@/features/catalog/components/search-bar";
import { SearchSuggestions } from "@/features/catalog/components/search-suggestions";
import {
  useCategories,
  useProductsInfinite,
  useSupermarkets,
} from "@/features/catalog/hooks/use-catalog";
import { useNutriPreferences } from "@/features/profile/hooks/use-nutri-preferences";
import { useProfile } from "@/features/profile/hooks/use-profile";
import { useSortUnitPreference } from "@/features/profile/hooks/use-sort-unit-preference";
import { useAuthStore } from "@/stores/auth.store";
import { useDebounce } from "@/hooks/use-debounce";
import { useLocale } from "@/hooks/use-locale";
import { useOnClickOutside } from "@/hooks/use-on-click-outside";
import { categoryLabel } from "@/features/catalog/utils/category-label";
import { cn } from "@/lib/utils";

const DIETARY_FLAGS: DietaryFlag[] = ["vegan", "vegetarian", "glutenFree", "lactoseFree"];

function parseDietFromUrl(raw: string | null): Set<DietaryFlag> {
  if (!raw) return new Set();
  const valid = new Set<DietaryFlag>();
  for (const token of raw.split(",")) {
    const t = token.trim() as DietaryFlag;
    if (DIETARY_FLAGS.includes(t)) valid.add(t);
  }
  return valid;
}


export function HomeClient() {
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  const router = useRouter();
  const searchParams = useSearchParams();

  // Seed search from `?q=` para schema.org SearchAction URL template
  // (`/?q={search_term_string}`) e deep-links de busca.
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const debouncedSearch = useDebounce(search, 300);
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [onPromotion, setOnPromotion] = useState(false);
  const { value: sortMode, setValue: setSortMode } = useSortUnitPreference();
  const nutri = useNutriPreferences();
  const sortByNutri = nutri.sortEnabled;
  const setSortByNutri = nutri.setSortEnabled;
  const [suggestOpen, setSuggestOpen] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const closeSuggest = useCallback(() => {
    setSuggestOpen(false);
    // Restore focus to input so Escape from dropdown doesn't drop user into body.
    // rAF waits React commit before focusing — ensures suggestion listbox unmounted.
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, []);
  const t = useTranslations("home");
  const tAria = useTranslations("common.aria");
  const tNav = useTranslations("nav");
  const locale = useLocale();

  useOnClickOutside(searchWrapperRef, () => setSuggestOpen(false), suggestOpen);
  // Nota: click-outside NÃO restaura focus (user já clicou noutro lugar).
  // Só Escape / onClose explícito via closeSuggest() devolve focus ao input.

  const { data: profile } = useProfile();

  // Preferências dietéticas: URL vence; se ausente E user tem prefers*, usa profile.
  const urlDietRaw = searchParams.get("diet");
  const dietary = useMemo(() => {
    if (urlDietRaw !== null) return parseDietFromUrl(urlDietRaw);
    if (!profile) return new Set<DietaryFlag>();
    const fromProfile = new Set<DietaryFlag>();
    if (profile.prefersVegan) fromProfile.add("vegan");
    if (profile.prefersVegetarian) fromProfile.add("vegetarian");
    if (profile.prefersGlutenFree) fromProfile.add("glutenFree");
    if (profile.prefersLactoseFree) fromProfile.add("lactoseFree");
    return fromProfile;
  }, [urlDietRaw, profile]);

  // URL `?healthy=1` vence profile (deep-link). Ausência → profile.
  const urlHealthy = searchParams.get("healthy");
  const onlyHealthy = urlHealthy === "1" ? true : nutri.healthyOnly;

  const toggleOnlyHealthy = useCallback(() => {
    const next = !onlyHealthy;
    const params = new URLSearchParams(searchParams.toString());
    // Normaliza: toggle sempre limpa URL, persiste no profile.
    params.delete("healthy");
    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : "/", { scroll: false });
    nutri.setHealthyOnly(next);
  }, [onlyHealthy, router, searchParams, nutri]);

  const toggleDietary = useCallback(
    (flag: DietaryFlag) => {
      const next = new Set(dietary);
      if (next.has(flag)) next.delete(flag);
      else next.add(flag);
      const params = new URLSearchParams(searchParams.toString());
      const sorted = DIETARY_FLAGS.filter((f) => next.has(f));
      if (sorted.length > 0) {
        params.set("diet", sorted.join(","));
      } else {
        // Set vazio: remove param pra URL limpa. Ausência vs vazio semanticamente
        // significava override local — agora profile dirige se URL não tem ?diet=,
        // mas ao desligar tudo o usuário também não quer forçar restrições.
        params.delete("diet");
      }
      const qs = params.toString();
      router.replace(qs ? `/?${qs}` : "/", { scroll: false });
    },
    [dietary, router, searchParams],
  );

  const supermarkets = useSupermarkets();
  const categories = useCategories();
  const products = useProductsInfinite({
    search: debouncedSearch || undefined,
    category,
    onPromotion: onPromotion || undefined,
    isVegan: dietary.has("vegan") || undefined,
    isVegetarian: dietary.has("vegetarian") || undefined,
    isGlutenFree: dietary.has("glutenFree") || undefined,
    isLactoseFree: dietary.has("lactoseFree") || undefined,
    limit: 20,
  });
  const allItems = useMemo(
    () => products.data?.pages.flatMap((p) => p.items) ?? [],
    [products.data],
  );
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && products.hasNextPage && !products.isFetchingNextPage) {
          products.fetchNextPage();
        }
      },
      { rootMargin: "320px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [products.hasNextPage, products.isFetchingNextPage, products]);

  const searchPending = search !== debouncedSearch;
  const searching = searchPending && search.length > 0;

  useEffect(() => {
    // Scroll to top smooth when debouncedSearch changes
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [debouncedSearch]);

  const sortedItems = useMemo(() => {
    const items = allItems;
    const filtered = onlyHealthy
      ? items.filter((p) => isHealthyGrade(p.nutriScore?.grade))
      : items;
    if (sortByNutri) {
      return filtered
        .slice()
        .sort(
          (a, b) =>
            nutriSortValue(a.nutriScore?.grade) -
            nutriSortValue(b.nutriScore?.grade),
        );
    }
    if (sortMode === "absolute") return filtered;
    // Unit mode: sort by cheapestUnitPrice.value ASC; produtos sem unitPrice vão ao fim
    return filtered.slice().sort((a, b) => {
      const au = a.cheapestUnitPrice?.value ?? Infinity;
      const bu = b.cheapestUnitPrice?.value ?? Infinity;
      return au - bu;
    });
  }, [allItems, sortMode, sortByNutri, onlyHealthy]);

  return (
    <main className="flex-1 flex flex-col px-4 py-6 pb-16">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-cesta-green">
            Cesta
          </h1>
          <p className="text-xs text-muted">{t("locationSubtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Features primárias (Favoritos/Comparar/Mi lista/Mi cuenta/Inicio) migradas
              pra bottom-nav. Header mantém só atalhos secundários + ação de sessão. */}
          {isHydrated && user && (
            <>
              <Button asChild size="icon" variant="secondary" aria-label={tAria("alerts")}>
                <Link href="/alertas">
                  <Bell className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="icon" variant="secondary" aria-label={tAria("myExpenses")}>
                <Link href="/gastos">
                  <Receipt className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="icon" variant="secondary" aria-label={tAria("familyBasket")}>
                <Link href="/minha-cesta">
                  <ShoppingBasket className="h-4 w-4" />
                </Link>
              </Button>
            </>
          )}
          {isHydrated && !user && (
            <Button asChild size="sm">
              <Link href="/login">{tNav("login")}</Link>
            </Button>
          )}
        </div>
      </header>

      {/* Search */}
      <div className="relative" ref={searchWrapperRef}>
        <SearchBar
          inputRef={searchInputRef}
          value={search}
          onChange={(v) => {
            setSearch(v);
            setSuggestOpen(true);
          }}
          onFocus={() => setSuggestOpen(true)}
          isPending={searchPending || products.isFetching}
          placeholder={t("searchPlaceholder")}
          clearLabel={t("clearSearch")}
          ariaExpanded={suggestOpen}
          className="mb-1"
        />
        {suggestOpen && (
          <SearchSuggestions
            query={search}
            onSelect={() => setSuggestOpen(false)}
            onSelectRecent={(q) => {
              setSearch(q);
              setSuggestOpen(false);
            }}
            onClose={closeSuggest}
          />
        )}
      </div>
      {searching ? (
        <p className="mb-3 text-sm text-muted">{t("searching")}</p>
      ) : (
        <div className="mb-3" />
      )}

      <ColdStartHint
        active={
          products.isPending || categories.isPending || supermarkets.isPending
        }
        className="mb-3"
      />

      {/* Filters: supermarkets badges */}
      {supermarkets.data && (
        <div className="mb-3 flex flex-wrap gap-2">
          {supermarkets.data.map((sm) => (
            <span
              key={sm.id}
              className="rounded-pill px-3 py-1 text-[10px] font-medium text-white"
              style={{ backgroundColor: sm.color ?? "var(--color-cesta-green)" }}
            >
              {sm.name}
            </span>
          ))}
        </div>
      )}

      {/* Categories */}
      <div className="-mx-4 mb-4 overflow-x-auto px-4">
        <div className="flex gap-2 pb-2">
          {categories.isPending ? (
            <>
              {Array.from({ length: 8 }).map((_, i) => (
                <CategoryChipSkeleton key={i} width={80 + (i % 3) * 24} />
              ))}
            </>
          ) : (
            <>
              <button
                onClick={() => setCategory(undefined)}
                className={`whitespace-nowrap rounded-pill px-3 py-2 text-xs font-medium cursor-pointer ${
                  !category
                    ? "bg-cesta-green text-white"
                    : "bg-surface text-muted hover:text-ink"
                }`}
              >
                {t("allCategories")}
              </button>
              {(categories.data ?? []).map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.slug)}
                  className={`whitespace-nowrap rounded-pill px-3 py-2 text-xs font-medium cursor-pointer ${
                    category === c.slug
                      ? "bg-cesta-green text-white"
                      : "bg-surface text-muted hover:text-ink"
                  }`}
                >
                  {categoryLabel(c, locale)}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Sprint 132: Melhores ofertas (top produtos com maior gap preço entre supermarkets) */}
      <FeaturedDeals limit={10} />

      {/* Dietary filters + Nutri-Score chips */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <DietaryFilters active={dietary} onToggle={toggleDietary} />
        <NutriFilters
          sortByNutri={sortByNutri}
          onSortByNutriChange={setSortByNutri}
          onlyHealthy={onlyHealthy}
          onOnlyHealthyChange={(v) => {
            if (v === onlyHealthy) return;
            toggleOnlyHealthy();
          }}
        />
      </div>

      {/* Promotion toggle + sort mode */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-ink cursor-pointer">
          <input
            type="checkbox"
            checked={onPromotion}
            onChange={(e) => setOnPromotion(e.target.checked)}
            className="h-4 w-4 accent-cesta-green"
          />
          {t("onlyPromotion")}
        </label>
        <div className="inline-flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className={cn(sortByNutri && "opacity-40")}>
            {t("sortLabel")}
          </span>
          {(["absolute", "unit"] as const).map((mode) => {
            const active = !sortByNutri && sortMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setSortMode(mode)}
                aria-pressed={active}
                disabled={sortByNutri}
                className={cn(
                  "rounded-pill px-2.5 py-1 text-[11px] font-semibold cursor-pointer transition-colors",
                  active
                    ? "bg-cesta-green text-white"
                    : "bg-surface text-muted hover:text-ink",
                  sortByNutri && "cursor-not-allowed opacity-40",
                )}
              >
                {mode === "absolute" ? t("sortAbsolute") : t("sortUnit")}
              </button>
            );
          })}
        </div>
      </div>

      {/* Products list */}
      {products.isPending ? (
        <div className="grid grid-cols-1 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : products.isError ? (
        <p className="py-6 text-center text-sm text-coral">
          {t("loadError")}
        </p>
      ) : sortedItems.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-3">
            {sortedItems.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                sortMode={sortMode}
                highlight={debouncedSearch || undefined}
              />
            ))}
          </div>
          {products.hasNextPage && (
            <div ref={sentinelRef} className="mt-4 grid grid-cols-1 gap-3" aria-hidden>
              {products.isFetchingNextPage && (
                <>
                  <ProductCardSkeleton />
                  <ProductCardSkeleton />
                </>
              )}
            </div>
          )}
        </>
      ) : (
        <HomeEmptyState
          query={debouncedSearch || undefined}
          categoryLabel={
            category
              ? (() => {
                  const match = categories.data?.find((c) => c.slug === category);
                  return match ? categoryLabel(match, locale) : undefined;
                })()
              : undefined
          }
          onReset={() => {
            setSearch("");
            setCategory(undefined);
            setOnPromotion(false);
            setSortByNutri(false);
            if (onlyHealthy) {
              const params = new URLSearchParams(searchParams.toString());
              params.delete("healthy");
              const qs = params.toString();
              router.replace(qs ? `/?${qs}` : "/", { scroll: false });
              nutri.setHealthyOnly(false);
            }
          }}
        />
      )}
    </main>
  );
}
