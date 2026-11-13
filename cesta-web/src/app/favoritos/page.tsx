"use client";

import { ArrowLeft, Check, Heart, Loader2, Scale, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  useFavorites,
  useRemoveFavorite,
} from "@/features/favorites/hooks/use-favorites";
import { useAuthStore } from "@/stores/auth.store";
import { cn, formatPrice } from "@/lib/utils";
import { formatUnitPrice } from "@/features/catalog/utils/format-unit-price";
import { useLocale } from "@/features/catalog/hooks/use-locale";
import { DietaryFilters, type DietaryFlag } from "@/features/catalog/components/dietary-filters";
import {
  NutriFilters,
  isHealthyGrade,
  nutriSortValue,
} from "@/features/catalog/components/nutri-filters";
import { UnitSortToggle } from "@/features/catalog/components/unit-sort-toggle";
import { useNutriPreferences } from "@/features/profile/hooks/use-nutri-preferences";
import { useProfile } from "@/features/profile/hooks/use-profile";
import { useSortUnitPreference } from "@/features/profile/hooks/use-sort-unit-preference";

const COMPARE_MAX = 4;
const DIETARY_FLAGS: DietaryFlag[] = ["vegan", "vegetarian", "glutenFree", "lactoseFree"];

function parseDietFromUrl(raw: string | null): Set<DietaryFlag> {
  if (raw === null) return new Set();
  const valid = new Set<DietaryFlag>();
  for (const token of raw.split(",")) {
    const t = token.trim() as DietaryFlag;
    if (DIETARY_FLAGS.includes(t)) valid.add(t);
  }
  return valid;
}

const FLAG_TO_PRODUCT_KEY = {
  vegan: "isVegan",
  vegetarian: "isVegetarian",
  glutenFree: "isGlutenFree",
  lactoseFree: "isLactoseFree",
} as const;

export default function FavoritosPage() {
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, isLoading } = useFavorites();
  const { data: profile } = useProfile();
  const remove = useRemoveFavorite();
  const locale = useLocale();
  const t = useTranslations("favorites");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const nutri = useNutriPreferences();
  const sortByNutri = nutri.sortEnabled;
  const setSortByNutri = nutri.setSortEnabled;
  const onlyHealthy = nutri.healthyOnly;
  const setOnlyHealthy = nutri.setHealthyOnly;

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

  const toggleDietary = useCallback(
    (flag: DietaryFlag) => {
      const next = new Set(dietary);
      if (next.has(flag)) next.delete(flag);
      else next.add(flag);
      const params = new URLSearchParams(searchParams.toString());
      const sorted = DIETARY_FLAGS.filter((f) => next.has(f));
      params.set("diet", sorted.join(","));
      router.replace(`/favoritos?${params.toString()}`, { scroll: false });
    },
    [dietary, router, searchParams],
  );

  const clearFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("diet", "");
    router.replace(`/favoritos?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    if (isHydrated && !user) {
      router.replace(`/login?returnUrl=${encodeURIComponent("/favoritos")}`);
    }
  }, [isHydrated, user, router]);

  const favorites = useMemo(() => data ?? [], [data]);
  const filtered = useMemo(() => {
    let out = favorites;
    if (dietary.size > 0) {
      out = out.filter((fav) => {
        const p = fav.product;
        if (!p) return false;
        for (const flag of dietary) {
          const key = FLAG_TO_PRODUCT_KEY[flag];
          if (!p[key]) return false;
        }
        return true;
      });
    }
    if (onlyHealthy) {
      out = out.filter((fav) => isHealthyGrade(fav.product?.nutriScore?.grade));
    }
    return out;
  }, [favorites, dietary, onlyHealthy]);
  const hasActiveFilters = dietary.size > 0 || onlyHealthy;

  const { value: sortMode, setValue: setSortMode } = useSortUnitPreference();
  const sorted = useMemo(() => {
    if (sortByNutri) {
      return filtered
        .slice()
        .sort(
          (a, b) =>
            nutriSortValue(a.product?.nutriScore?.grade) -
            nutriSortValue(b.product?.nutriScore?.grade),
        );
    }
    if (sortMode === "absolute") return filtered;
    return filtered.slice().sort((a, b) => {
      const au = a.cheapestPrice?.unitPrice?.value ?? Infinity;
      const bu = b.cheapestPrice?.unitPrice?.value ?? Infinity;
      return au - bu;
    });
  }, [filtered, sortMode, sortByNutri]);

  if (!isHydrated || !user) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-cesta-green" />
      </main>
    );
  }

  function toggleSelect(productId: string) {
    setSelected((prev) => {
      if (prev.includes(productId)) return prev.filter((id) => id !== productId);
      if (prev.length >= COMPARE_MAX) return prev;
      return [...prev, productId];
    });
  }

  function goCompare() {
    if (selected.length < 2) return;
    router.push(`/comparar?products=${selected.join(",")}`);
  }

  function cancelSelect() {
    setSelectMode(false);
    setSelected([]);
  }

  return (
    <main className="pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-cream px-4 py-3">
        <Button asChild size="icon" variant="ghost" aria-label="Volver">
          <Link href="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="flex-1 font-display text-lg font-bold text-ink">
          {t("title")}
          {hasActiveFilters && favorites.length > 0 && (
            <span className="ml-2 text-xs font-normal text-muted">
              ({t("filteredCount", { visible: filtered.length, total: favorites.length })})
            </span>
          )}
        </h1>
        {favorites.length > 0 && !selectMode && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelectMode(true)}
          >
            <Scale className="h-4 w-4" />
            Comparar
          </Button>
        )}
        {selectMode && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={cancelSelect}
          >
            Cancelar
          </Button>
        )}
      </header>

      {favorites.length > 0 && (
        <section className="px-4 pt-2 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <DietaryFilters active={dietary} onToggle={toggleDietary} />
            <NutriFilters
              sortByNutri={sortByNutri}
              onSortByNutriChange={setSortByNutri}
              onlyHealthy={onlyHealthy}
              onOnlyHealthyChange={setOnlyHealthy}
            />
          </div>
          <UnitSortToggle
            value={sortMode}
            onChange={setSortMode}
            variant="compact"
            disabled={sortByNutri}
          />
        </section>
      )}

      <section className="px-4 pt-2">
        {isLoading ? (
          <ul className="space-y-3">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="h-24 animate-pulse rounded-card bg-surface"
              />
            ))}
          </ul>
        ) : favorites.length === 0 ? (
          <EmptyState />
        ) : filtered.length === 0 ? (
          <FilteredEmptyState onClear={clearFilters} />
        ) : (
          <ul className="space-y-3">
            {sorted.map((fav) => {
              const isSelected = selected.includes(fav.productId);
              return (
                <li
                  key={fav.id}
                  className={cn(
                    "flex items-center gap-3 rounded-card bg-white p-3 shadow-sm transition-all",
                    selectMode && isSelected && "ring-2 ring-cesta-green",
                  )}
                >
                  {selectMode && (
                    <button
                      type="button"
                      onClick={() => toggleSelect(fav.productId)}
                      aria-label={isSelected ? "Deseleccionar" : "Seleccionar"}
                      aria-pressed={isSelected}
                      className={cn(
                        "inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-2 cursor-pointer",
                        isSelected
                          ? "border-cesta-green bg-cesta-green text-white"
                          : "border-neutral-300 text-transparent",
                      )}
                    >
                      <Check className="h-5 w-5" />
                    </button>
                  )}
                  <Link
                    href={
                      selectMode ? "#" : `/produto/${fav.productId}`
                    }
                    onClick={(e) => {
                      if (selectMode) {
                        e.preventDefault();
                        toggleSelect(fav.productId);
                      }
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-md bg-surface text-muted">
                      {fav.product?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={fav.product.imageUrl}
                          alt=""
                          className="h-full w-full rounded-md object-cover"
                        />
                      ) : (
                        <Heart className="h-6 w-6" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {fav.product?.name ?? "Produto"}
                      </p>
                      {fav.product?.brand && (
                        <p className="truncate text-xs text-muted">
                          {fav.product.brand}
                        </p>
                      )}
                      {fav.cheapestPrice ? (
                        sortMode === "unit" && fav.cheapestPrice.unitPrice ? (
                          <>
                            <p className="mt-1 text-sm font-semibold text-cesta-green">
                              {formatUnitPrice(fav.cheapestPrice.unitPrice, locale)}
                              <span className="ml-1 text-xs font-normal text-muted">
                                en {fav.cheapestPrice.supermarketName}
                              </span>
                            </p>
                            <p className="text-xs text-muted">
                              {formatPrice(fav.cheapestPrice.price)}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="mt-1 text-sm font-semibold text-cesta-green">
                              {formatPrice(fav.cheapestPrice.price)}{" "}
                              <span className="text-xs font-normal text-muted">
                                en {fav.cheapestPrice.supermarketName}
                              </span>
                            </p>
                            {fav.cheapestPrice.unitPrice && (
                              <p className="text-xs text-muted">
                                {formatUnitPrice(fav.cheapestPrice.unitPrice, locale)}
                              </p>
                            )}
                          </>
                        )
                      ) : (
                        <p className="mt-1 text-xs text-muted">
                          Sin precio disponible
                        </p>
                      )}
                    </div>
                  </Link>
                  {!selectMode && (
                    <button
                      type="button"
                      onClick={() => remove.mutate(fav.productId)}
                      disabled={remove.isPending}
                      aria-label="Quitar de favoritos"
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {selectMode && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white p-4 shadow-lg">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <span className="text-sm text-muted">
              {selected.length}/{COMPARE_MAX} seleccionados
            </span>
            <Button
              type="button"
              className="flex-1"
              onClick={goCompare}
              disabled={selected.length < 2}
            >
              <Scale className="h-4 w-4" />
              Comparar {selected.length > 0 && `(${selected.length})`}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card bg-white px-6 py-10 text-center shadow-sm">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface">
        <Heart className="h-8 w-8 text-muted" />
      </div>
      <p className="font-display text-base font-bold text-ink">
        Aún no tienes favoritos
      </p>
      <p className="max-w-xs text-sm text-muted">
        Toca ♥ en cualquier producto para guardarlo aquí y comparar sus precios
        después.
      </p>
      <Button asChild size="sm">
        <Link href="/">Explorar productos</Link>
      </Button>
    </div>
  );
}

function FilteredEmptyState({ onClear }: { onClear: () => void }) {
  const t = useTranslations("favorites");
  return (
    <div className="flex flex-col items-center gap-3 rounded-card bg-white px-6 py-10 text-center shadow-sm">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface">
        <Heart className="h-8 w-8 text-muted" />
      </div>
      <p className="font-display text-base font-bold text-ink">
        {t("emptyFilteredTitle")}
      </p>
      <Button type="button" size="sm" variant="secondary" onClick={onClear}>
        {t("emptyFilteredCta")}
      </Button>
    </div>
  );
}
