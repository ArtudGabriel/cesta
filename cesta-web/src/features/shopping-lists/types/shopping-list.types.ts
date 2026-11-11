import type { Product } from "@/features/catalog/types/catalog.types";

export interface ShoppingListItem {
  id: string;
  productId: string;
  quantity: number;
  position: number;
  product: Product;
}

export interface ShoppingList {
  id: string;
  name: string;
  itemCount: number;
  cheapestTotal: number | null;
  cheapestSupermarketSlug: string | null;
  createdAt: string;
  updatedAt: string;
  items?: ShoppingListItem[];
}

export interface SupermarketTotal {
  supermarketId: string;
  supermarketSlug: string;
  supermarketName: string;
  supermarketColor: string | null;
  total: number;
  availableItems: number;
  missingItems: number;
  itemsBreakdown: Array<{
    productId: string;
    quantity: number;
    unitPrice: number | null;
    subtotal: number | null;
    onPromotion: boolean;
    isAvailable: boolean;
  }>;
}

export interface HybridItem {
  productId: string;
  productName: string;
  quantity: number;
  supermarketSlug: string;
  supermarketName: string;
  supermarketColor: string | null;
  unitPrice: number;
  subtotal: number;
  onPromotion: boolean;
}

export interface ListTotals {
  bySupermarket: SupermarketTotal[];
  cheapestSupermarketSlug: string | null;
  cheapestTotal: number | null;
  mostExpensiveTotal: number | null;
  savingsVsMostExpensive: number;
  hybridItems: HybridItem[];
  hybridTotal: number;
  hybridSavings: number;
  generatedAt: string;
}
