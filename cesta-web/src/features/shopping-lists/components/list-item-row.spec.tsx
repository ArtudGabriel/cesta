import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils";
import { ListItemRow } from "./list-item-row";
import type { ShoppingListItem } from "../types/shopping-list.types";

vi.mock("../hooks/use-shopping-lists", () => ({
  useUpdateItem: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveItem: () => ({ mutate: vi.fn(), isPending: false }),
}));

function makeItem(
  overrides: Partial<ShoppingListItem["product"]> = {},
): ShoppingListItem {
  return {
    id: "li-1",
    productId: "p-1",
    quantity: 2,
    position: 0,
    product: {
      id: "p-1",
      name: "Aceite oliva 1L",
      brand: "Carbonell",
      imageUrl: null,
      categoryId: null,
      packageSize: 1,
      packageUnit: "LITER",
      comparisonUnit: "LITER",
      calories: null,
      protein: null,
      fat: null,
      saturatedFat: null,
      carbs: null,
      sugar: null,
      salt: null,
      fiber: null,
      nutritionPer: null,
      nutriScore: null,
      isVegan: false,
      isVegetarian: false,
      isGlutenFree: false,
      isLactoseFree: false,
      prices: [
        {
          supermarketId: "s-mer",
          supermarketSlug: "mercadona",
          supermarketName: "Mercadona",
          supermarketColor: "#1a7f3e",
          price: 5.5,
          unitPrice: { value: 5.5, unit: "L" },
          onPromotion: false,
          previousPrice: null,
          isAvailable: true,
          isStale: false,
          lastSyncedAt: new Date().toISOString(),
          confidenceScore: 1,
        },
      ],
      cheapestSupermarketSlug: "mercadona",
      cheapestPrice: 5.5,
      cheapestUnitPrice: { value: 5.5, unit: "L" },
      isStale: false,
      ...overrides,
    },
  };
}

describe("ListItemRow (Sprint 165 unit price secondary)", () => {
  it("renderiza unit price secondary quando cheapestUnitPrice existe", () => {
    const { getByTestId } = renderWithProviders(
      <ListItemRow listId="l-1" item={makeItem()} />,
    );
    const unit = getByTestId("list-item-row-unit-price");
    expect(unit.textContent).toContain("5,50");
    expect(unit.textContent).toContain("L");
  });

  it("NÃO renderiza unit price quando cheapestUnitPrice=null", () => {
    const { queryByTestId } = renderWithProviders(
      <ListItemRow
        listId="l-1"
        item={makeItem({ cheapestUnitPrice: null, comparisonUnit: "UNIT" })}
      />,
    );
    expect(queryByTestId("list-item-row-unit-price")).toBeNull();
  });
});
