import type { Operations, Schemas } from "@/types/api";

/**
 * Sprint 212 — Product/NutriScore/UnitPrice/PriceByMarket adotam baseline
 * (S211 ADR 0024 saneou @ApiProperty nullable → schemas concretos). Zero
 * paralelo, zero as any/as unknown.
 *
 * G3 (DoD S212) preservações locais:
 *   - `Supermarket`, `Category` — backend `/supermarkets` e `/categories`
 *     controllers ainda NÃO têm @ApiResponse spec (deferred S213+ catalog
 *     controllers decoration). Shapes handcrafted até gerados.
 *   - `MeasureUnit`, `UnitPriceSuffix`, `NutriGrade` — enums reutilizáveis
 *     sem DTO próprio no baseline; derivados em cima do novo Product.
 *
 * Request types continuam S210 via `Operations["Controller_findMany"]`.
 */

export type Product = Schemas["ProductResponseDto"];
export type NutriScore = Schemas["NutriScoreDto"];
export type UnitPrice = Schemas["UnitPriceDto"];
export type PriceByMarket = Schemas["PriceByMarketDto"];

export type MeasureUnit = Product["packageUnit"];
export type UnitPriceSuffix = UnitPrice["unit"];
export type NutriGrade = NutriScore["grade"];

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
