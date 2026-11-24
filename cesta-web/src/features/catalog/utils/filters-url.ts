import type { NutriGrade, ProductFilters } from "../types/catalog.types";

const DIETARY_KEYS = [
  "isVegan",
  "isVegetarian",
  "isGlutenFree",
  "isLactoseFree",
] as const;

/**
 * Sprint 147: serializar/deserializar `ProductFilters` ↔ URLSearchParams.
 * Shareable links preservam seleção pós-refresh. Mantém keys estáveis
 * (sem camelCase quebrado) + arrays vêm como CSV (ex.: `supermarkets=a,b`).
 */
export function filtersToSearchParams(
  filters: ProductFilters,
): URLSearchParams {
  const params = new URLSearchParams();
  const set = (key: string, value: string) => params.set(key, value);
  if (filters.search) set("search", filters.search);
  if (filters.category) set("category", filters.category);
  if (filters.supermarket) set("supermarket", filters.supermarket);
  if (filters.supermarkets && filters.supermarkets.length > 0) {
    set("supermarkets", filters.supermarkets.join(","));
  }
  if (filters.brand) set("brand", filters.brand);
  if (filters.minPrice !== undefined) set("minPrice", String(filters.minPrice));
  if (filters.maxPrice !== undefined) set("maxPrice", String(filters.maxPrice));
  if (filters.onPromotion) set("onPromotion", "true");
  for (const key of DIETARY_KEYS) {
    if (filters[key]) set(key, "true");
  }
  if (filters.nutriScore) set("nutriScore", filters.nutriScore);
  if (filters.sortBy) set("sortBy", filters.sortBy);
  if (filters.page && filters.page > 1) set("page", String(filters.page));
  if (filters.limit && filters.limit !== 20) set("limit", String(filters.limit));
  return params;
}

export function filtersFromSearchParams(
  params: URLSearchParams | ReadonlyURLSearchParams | null | undefined,
): ProductFilters {
  if (!params) return {};
  const get = (key: string) => params.get(key);
  const out: ProductFilters = {};
  const search = get("search");
  if (search) out.search = search;
  const category = get("category");
  if (category) out.category = category;
  const supermarket = get("supermarket");
  if (supermarket) out.supermarket = supermarket;
  const supermarkets = get("supermarkets");
  if (supermarkets) {
    const list = supermarkets
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length > 0) out.supermarkets = list;
  }
  const brand = get("brand");
  if (brand) out.brand = brand;
  const min = get("minPrice");
  if (min !== null && min !== "" && Number.isFinite(Number(min))) {
    out.minPrice = Number(min);
  }
  const max = get("maxPrice");
  if (max !== null && max !== "" && Number.isFinite(Number(max))) {
    out.maxPrice = Number(max);
  }
  if (get("onPromotion") === "true") out.onPromotion = true;
  for (const key of DIETARY_KEYS) {
    if (get(key) === "true") out[key] = true;
  }
  const grade = get("nutriScore");
  if (grade && ["A", "B", "C", "D", "E"].includes(grade)) {
    out.nutriScore = grade as NutriGrade;
  }
  const sortBy = get("sortBy");
  if (sortBy && ["cheapest", "newest", "name", "nutriScore"].includes(sortBy)) {
    out.sortBy = sortBy as ProductFilters["sortBy"];
  }
  const page = get("page");
  if (page !== null && page !== "" && Number.isFinite(Number(page))) {
    out.page = Number(page);
  }
  const limit = get("limit");
  if (limit !== null && limit !== "" && Number.isFinite(Number(limit))) {
    out.limit = Number(limit);
  }
  return out;
}

// Next.js `URLSearchParams` readonly shape — não instanciável, só leitura.
type ReadonlyURLSearchParams = {
  get(name: string): string | null;
};
