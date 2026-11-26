export type MeasureUnit =
  | "LITER"
  | "MILLILITER"
  | "KILOGRAM"
  | "GRAM"
  | "UNIT";

export interface Supermarket {
  id: string;
  slug: string;
  name: string;
  color: string | null;
  logoUrl: string | null;
  website: string | null;
  isActive: boolean;
}

export interface Category {
  id: string;
  slug: string;
  nameEs: string;
  namePt: string;
  parentId: string | null;
  order: number;
  children?: Category[];
}

export type UnitPriceSuffix = "L" | "kg" | "100g" | "100ml" | "un";

export type NutriGrade = "A" | "B" | "C" | "D" | "E";

export interface NutriScore {
  score: number;
  grade: NutriGrade;
}

export interface UnitPrice {
  value: number;
  unit: UnitPriceSuffix;
}

export interface PriceByMarket {
  supermarketId: string;
  supermarketSlug: string;
  supermarketName: string;
  supermarketColor: string | null;
  price: number;
  unitPrice: UnitPrice | null;
  onPromotion: boolean;
  previousPrice: number | null;
  isAvailable: boolean;
  isStale: boolean;
  lastSyncedAt: string;
  confidenceScore: number;
}

export interface Product {
  id: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  categoryId: string | null;
  packageSize: number;
  packageUnit: MeasureUnit;
  comparisonUnit: MeasureUnit;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  saturatedFat: number | null;
  carbs: number | null;
  sugar: number | null;
  salt: number | null;
  fiber: number | null;
  nutritionPer: number | null;
  nutriScore: NutriScore | null;
  isVegan: boolean;
  isVegetarian: boolean;
  isGlutenFree: boolean;
  isLactoseFree: boolean;
  prices: PriceByMarket[];
  cheapestSupermarketSlug: string | null;
  cheapestPrice: number | null;
  cheapestUnitPrice: UnitPrice | null;
}

import type { Operations } from "@/types/api";

/**
 * Sprint 210 — filtros tipados via baseline query params (S209 ADR 0022).
 *
 * Pick<> mantém restrição frontend S151 (rollback campos avançados):
 * minPrice/supermarkets[]/nutriScore/sortBy=nutriScore são aceitos pelo
 * backend mas NÃO expostos pela UI — reintroduzir quando shell de filtros
 * voltar. sortBy mantém subset `cheapest | newest | name` por intersecção.
 */
type FindManyQuery = NonNullable<
  Operations["ProductsController_findMany"]["parameters"]["query"]
>;

export type ProductFilters = Pick<
  FindManyQuery,
  | "search"
  | "category"
  | "supermarket"
  | "brand"
  | "maxPrice"
  | "onPromotion"
  | "isVegan"
  | "isVegetarian"
  | "isGlutenFree"
  | "isLactoseFree"
  | "page"
  | "limit"
> & {
  sortBy?: "cheapest" | "newest" | "name";
};

export interface Paginated<T> {
  items: T[];
  meta: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}
