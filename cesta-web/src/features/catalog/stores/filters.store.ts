"use client";

import { create } from "zustand";
import type { NutriGrade, ProductFilters } from "../types/catalog.types";

/**
 * Sprint 147: estado client-side dos filtros do catálogo. React Query
 * continua dono do server-state; aqui vive só o que o user clicou.
 *
 * - `filters` é imutável externamente: `set*`/`toggle*` produzem versões
 *   novas.
 * - `applyPartial` facilita hidratação a partir de URL search params ou
 *   route params (`/categoria/[slug]` injeta `category`).
 * - `resetAll` limpa tudo exceto `category` quando `keepCategory=true`
 *   (user na página de categoria quer reset mas manter escopo).
 */
export type DietaryKey =
  | "isVegan"
  | "isVegetarian"
  | "isGlutenFree"
  | "isLactoseFree";

const DIETARY_KEYS: DietaryKey[] = [
  "isVegan",
  "isVegetarian",
  "isGlutenFree",
  "isLactoseFree",
];

export interface FiltersState {
  filters: ProductFilters;
  applyPartial: (patch: Partial<ProductFilters>) => void;
  setCategory: (slug: string | undefined) => void;
  setSearch: (q: string | undefined) => void;
  setPriceRange: (min: number | undefined, max: number | undefined) => void;
  togglePromo: () => void;
  toggleDietary: (key: DietaryKey) => void;
  toggleSupermarket: (slug: string) => void;
  setNutriScore: (grade: NutriGrade | undefined) => void;
  setSortBy: (sortBy: NonNullable<ProductFilters["sortBy"]> | undefined) => void;
  resetAll: (opts?: { keepCategory?: boolean }) => void;
}

function withoutUndefined(
  filters: ProductFilters,
): ProductFilters {
  const clean: ProductFilters = {};
  for (const [key, value] of Object.entries(filters) as Array<
    [keyof ProductFilters, unknown]
  >) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    // @ts-expect-error — dynamic assignment into partial record
    clean[key] = value;
  }
  return clean;
}

export const useFiltersStore = create<FiltersState>()((set) => ({
  filters: {},

  applyPartial: (patch) =>
    set((state) => ({
      filters: withoutUndefined({ ...state.filters, ...patch }),
    })),

  setCategory: (slug) =>
    set((state) => ({
      filters: withoutUndefined({ ...state.filters, category: slug }),
    })),

  setSearch: (q) =>
    set((state) => ({
      filters: withoutUndefined({ ...state.filters, search: q }),
    })),

  setPriceRange: (min, max) =>
    set((state) => ({
      filters: withoutUndefined({
        ...state.filters,
        minPrice: min,
        maxPrice: max,
      }),
    })),

  togglePromo: () =>
    set((state) => ({
      filters: withoutUndefined({
        ...state.filters,
        onPromotion: state.filters.onPromotion ? undefined : true,
      }),
    })),

  toggleDietary: (key) =>
    set((state) => ({
      filters: withoutUndefined({
        ...state.filters,
        [key]: state.filters[key] ? undefined : true,
      }),
    })),

  toggleSupermarket: (slug) =>
    set((state) => {
      const current = state.filters.supermarkets ?? [];
      const next = current.includes(slug)
        ? current.filter((s) => s !== slug)
        : [...current, slug];
      return {
        filters: withoutUndefined({
          ...state.filters,
          // Ao usar múltiplos, zera o campo `supermarket` single.
          supermarket: undefined,
          supermarkets: next,
        }),
      };
    }),

  setNutriScore: (grade) =>
    set((state) => ({
      filters: withoutUndefined({ ...state.filters, nutriScore: grade }),
    })),

  setSortBy: (sortBy) =>
    set((state) => ({
      filters: withoutUndefined({ ...state.filters, sortBy }),
    })),

  resetAll: (opts) =>
    set((state) => ({
      filters: opts?.keepCategory && state.filters.category
        ? { category: state.filters.category }
        : {},
    })),
}));

export const DIETARY_FILTER_KEYS = DIETARY_KEYS;
