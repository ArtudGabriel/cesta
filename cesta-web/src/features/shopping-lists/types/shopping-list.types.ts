import type { Schemas } from "@/types/api";

/**
 * Sprint 212 — response types adotam baseline (S211 ADR 0024). Request
 * payloads continuam S210 (CreateListDto/UpdateListDto/AddItemDto/UpdateItemDto).
 *
 * G3 (DoD S212) preservações locais:
 *   - `ListTotals` + `SupermarketTotal` + `itemsBreakdown` — baseline
 *     `ListTotalsDto.bySupermarket: Record<string, never>[]` ainda é um
 *     leak: backend decorator do controller `/shopping-lists/:id/totals`
 *     não expôs schema concreto do breakdown por mercado. Mantido
 *     handcrafted até @ApiResponse spec completo (deferred S213+).
 *   - `HybridItem` deriva de `Schemas["HybridItemDto"]` (sem leak).
 */

export type ShoppingList = Schemas["ShoppingListResponseDto"];
export type ShoppingListItem = Schemas["ListItemDto"];
export type HybridItem = Schemas["HybridItemDto"];

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
