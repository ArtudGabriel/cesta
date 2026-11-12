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
  carbs: number | null;
  sugar: number | null;
  salt: number | null;
  fiber: number | null;
  isVegan: boolean;
  isVegetarian: boolean;
  isGlutenFree: boolean;
  isLactoseFree: boolean;
  prices: PriceByMarket[];
  cheapestSupermarketSlug: string | null;
  cheapestPrice: number | null;
  cheapestUnitPrice: UnitPrice | null;
}

export interface ProductFilters {
  search?: string;
  category?: string;
  supermarket?: string;
  brand?: string;
  maxPrice?: number;
  onPromotion?: boolean;
  isVegan?: boolean;
  isVegetarian?: boolean;
  isGlutenFree?: boolean;
  isLactoseFree?: boolean;
  sortBy?: "cheapest" | "newest" | "name";
  page?: number;
  limit?: number;
}

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
