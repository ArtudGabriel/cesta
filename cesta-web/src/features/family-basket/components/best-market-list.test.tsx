import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils";
import { BestMarketList } from "./best-market-list";
import type { BasketItem } from "../types/family-basket.types";

function makeItem(
  prices: Array<{
    slug: string;
    name: string;
    color: string | null;
    price: number;
  }>,
  quantity: number,
): BasketItem {
  return {
    id: `i-${Math.random()}`,
    productId: `p-${Math.random()}`,
    quantity,
    unitPrice: prices[0]?.price ?? 0,
    subtotal: (prices[0]?.price ?? 0) * quantity,
    isRequired: false,
    isLocked: false,
    position: 0,
    product: {
      id: `p-${Math.random()}`,
      name: "Produto",
      brand: null,
      imageUrl: null,
      categoryId: null,
      packageSize: 1,
      packageUnit: "UNIT",
      comparisonUnit: "UNIT",
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
      prices: prices.map((p) => ({
        supermarketId: `sm-${p.slug}`,
        supermarketSlug: p.slug,
        supermarketName: p.name,
        supermarketColor: p.color,
        price: p.price,
        unitPrice: null,
        onPromotion: false,
        previousPrice: null,
        isAvailable: true,
        isStale: false,
        lastSyncedAt: "2026-11-17T00:00:00Z",
        confidenceScore: 1,
      })),
      cheapestSupermarketSlug: prices[0]?.slug ?? null,
      cheapestPrice: prices[0]?.price ?? null,
      cheapestUnitPrice: null,
      isStale: false,
      canonicalProductId: null,
      canonicalGroupSize: 1,
      isSameProduct: false,
    },
  };
}

describe("BestMarketList", () => {
  it("ordena supermercados por total ascendente", () => {
    const items: BasketItem[] = [
      makeItem(
        [
          { slug: "mercadona", name: "Mercadona", color: null, price: 2 },
          { slug: "carrefour", name: "Carrefour", color: null, price: 3 },
        ],
        2,
      ),
      makeItem(
        [
          { slug: "mercadona", name: "Mercadona", color: null, price: 1.5 },
          { slug: "carrefour", name: "Carrefour", color: null, price: 1 },
        ],
        1,
      ),
    ];

    const { container } = renderWithProviders(<BestMarketList items={items} />);
    const names = Array.from(container.querySelectorAll("li p.text-sm")).map(
      (el) => el.textContent,
    );
    // Mercadona total = 2*2 + 1.5*1 = 5.5; Carrefour = 3*2 + 1 = 7
    expect(names[0]).toBe("Mercadona");
    expect(names[1]).toBe("Carrefour");
  });

  it("não renderiza nada se não houver items com preços", () => {
    const { container } = renderWithProviders(<BestMarketList items={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
