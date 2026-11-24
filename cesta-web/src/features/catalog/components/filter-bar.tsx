"use client";

import { Leaf, MilkOff, Salad, SlidersHorizontal, Tag, Wheat, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCategories, useSupermarkets } from "../hooks/use-catalog";
import {
  DIETARY_FILTER_KEYS,
  useFiltersStore,
  type DietaryKey,
} from "../stores/filters.store";
import type { NutriGrade } from "../types/catalog.types";
import { cn } from "@/lib/utils";

const DIETARY_ICONS: Record<DietaryKey, typeof Leaf> = {
  isVegan: Leaf,
  isVegetarian: Salad,
  isGlutenFree: Wheat,
  isLactoseFree: MilkOff,
};

const NUTRI_GRADES: NutriGrade[] = ["A", "B", "C", "D", "E"];
const NUTRI_COLORS: Record<NutriGrade, string> = {
  A: "bg-[#038141] text-white",
  B: "bg-[#85BB2F] text-black",
  C: "bg-[#FECB02] text-black",
  D: "bg-[#EE8100] text-white",
  E: "bg-[#E63E11] text-white",
};

interface FilterBarProps {
  /** Mascarar chip categoria (quando já embutido no route /categoria/[slug]). */
  hideCategory?: boolean;
  /** Fonte autoritativa do slug atual em `/categoria/[slug]` — usada
   *  pra dim/active do chip "Todas". */
  activeCategorySlug?: string | null;
}

/**
 * Sprint 147: FilterBar universal consumido por Home e /categoria/[slug].
 * Lê/escreve via `useFiltersStore` (Zustand client). React Query reage
 * no hook `useProducts(filters)` ao ver nova snapshot — zero refetch
 * redundante pq query key inclui `filters`.
 */
export function FilterBar({ hideCategory = false, activeCategorySlug }: FilterBarProps) {
  const t = useTranslations("filters");
  const filters = useFiltersStore((s) => s.filters);
  const setCategory = useFiltersStore((s) => s.setCategory);
  const toggleDietary = useFiltersStore((s) => s.toggleDietary);
  const togglePromo = useFiltersStore((s) => s.togglePromo);
  const toggleSupermarket = useFiltersStore((s) => s.toggleSupermarket);
  const setPriceRange = useFiltersStore((s) => s.setPriceRange);
  const setNutriScore = useFiltersStore((s) => s.setNutriScore);
  const resetAll = useFiltersStore((s) => s.resetAll);

  const categoriesQ = useCategories();
  const supermarketsQ = useSupermarkets();

  const categories = categoriesQ.data ?? [];
  const supermarkets = supermarketsQ.data ?? [];
  const activeSupermarketSlugs = new Set(filters.supermarkets ?? []);

  const anyActive =
    Object.keys(filters).filter(
      (k) => !["sortBy", "page", "limit"].includes(k),
    ).length > 0;

  return (
    <section
      data-sentry-unmask
      className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
      aria-label={t("aria.bar")}
    >
      <header className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          {t("title")}
        </h2>
        {anyActive && (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-900"
            onClick={() => resetAll({ keepCategory: Boolean(activeCategorySlug) })}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            {t("clear")}
          </button>
        )}
      </header>

      {/* Categorias (hide em /categoria/[slug]) */}
      {!hideCategory && categories.length > 0 && (
        <div className="-mx-4 overflow-x-auto px-4">
          <div className="flex gap-2 pb-1">
            <ChipButton
              active={!filters.category && !activeCategorySlug}
              onClick={() => setCategory(undefined)}
              label={t("categoryAll")}
            />
            {categories.map((c) => (
              <ChipButton
                key={c.slug}
                active={filters.category === c.slug}
                onClick={() => setCategory(c.slug)}
                label={c.nameEs}
              />
            ))}
          </div>
        </div>
      )}

      {/* Supermercados (multi-select) */}
      {supermarkets.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-neutral-500">
            {t("supermarket")}
          </p>
          <div className="flex flex-wrap gap-2">
            {supermarkets.map((s) => (
              <ChipButton
                key={s.slug}
                active={activeSupermarketSlugs.has(s.slug)}
                onClick={() => toggleSupermarket(s.slug)}
                label={s.name}
                color={s.color ?? undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* Range preço */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-neutral-500">
          {t("priceRange")}
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            min={0}
            placeholder={t("minPricePlaceholder")}
            value={filters.minPrice ?? ""}
            onChange={(e) => {
              const v = e.target.value === "" ? undefined : Number(e.target.value);
              setPriceRange(v, filters.maxPrice);
            }}
            className="w-20 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
            aria-label={t("aria.minPrice")}
          />
          <span className="text-xs text-neutral-400">—</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            min={0}
            placeholder={t("maxPricePlaceholder")}
            value={filters.maxPrice ?? ""}
            onChange={(e) => {
              const v = e.target.value === "" ? undefined : Number(e.target.value);
              setPriceRange(filters.minPrice, v);
            }}
            className="w-20 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
            aria-label={t("aria.maxPrice")}
          />
          <span className="text-xs text-neutral-500">€</span>
        </div>
      </div>

      {/* Dieta */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-neutral-500">
          {t("dietary")}
        </p>
        <div className="flex flex-wrap gap-2">
          {DIETARY_FILTER_KEYS.map((key) => {
            const Icon = DIETARY_ICONS[key];
            return (
              <ChipButton
                key={key}
                active={Boolean(filters[key])}
                onClick={() => toggleDietary(key)}
                label={t(`dietary.${key}`)}
                icon={<Icon className="h-3.5 w-3.5" aria-hidden />}
              />
            );
          })}
        </div>
      </div>

      {/* Nutri-Score */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-neutral-500">
          {t("nutriScore")}
        </p>
        <div className="flex flex-wrap gap-2">
          {NUTRI_GRADES.map((g) => {
            const active = filters.nutriScore === g;
            return (
              <button
                key={g}
                type="button"
                onClick={() => setNutriScore(active ? undefined : g)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                  NUTRI_COLORS[g],
                  active ? "ring-2 ring-offset-2 ring-neutral-900" : "opacity-70 hover:opacity-100",
                )}
                aria-label={t("aria.nutriScore", { grade: g })}
                aria-pressed={active}
              >
                {g}
              </button>
            );
          })}
        </div>
      </div>

      {/* Promo toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-500">
          {t("onPromotion")}
        </span>
        <ChipButton
          active={Boolean(filters.onPromotion)}
          onClick={togglePromo}
          label={filters.onPromotion ? t("yes") : t("no")}
          icon={<Tag className="h-3.5 w-3.5" aria-hidden />}
        />
      </div>
    </section>
  );
}

function ChipButton({
  active,
  onClick,
  label,
  icon,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
        active
          ? "border-transparent bg-neutral-900 text-white"
          : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300",
      )}
      aria-pressed={active}
      style={active && color ? { backgroundColor: color, borderColor: color } : undefined}
    >
      {icon}
      {label}
    </button>
  );
}
