import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils";
import { ProductCard } from "./product-card";
import type { Product } from "../types/catalog.types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
}));

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p-1",
    name: "Leche entera 1L",
    brand: "Hacendado",
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
        price: 1.2,
        unitPrice: { value: 1.2, unit: "L" },
        onPromotion: false,
        previousPrice: null,
        isAvailable: true,
        isStale: false,
        lastSyncedAt: new Date().toISOString(),
        confidenceScore: 1,
      },
    ],
    cheapestSupermarketSlug: "mercadona",
    cheapestPrice: 1.2,
    cheapestUnitPrice: { value: 1.2, unit: "L" },
    isStale: false,
    canonicalProductId: null,
    canonicalGroupSize: 1,
    isSameProduct: false,
    ...overrides,
  };
}

describe("ProductCard (Sprint 165 unit price display)", () => {
  it("renderiza primary price = currentPrice e secondary = unitPrice (sortMode=absolute)", () => {
    const { getByTestId } = renderWithProviders(
      <ProductCard product={makeProduct()} />,
    );
    const primary = getByTestId("product-card-primary-price");
    const secondary = getByTestId("product-card-secondary-price");
    expect(primary.textContent).toContain("1,20");
    expect(secondary.textContent).toContain("1,20");
    expect(secondary.textContent).toContain("L");
  });

  it("sortMode=unit inverte: primary = unitPrice, secondary = currentPrice", () => {
    const { getByTestId } = renderWithProviders(
      <ProductCard product={makeProduct()} sortMode="unit" />,
    );
    const primary = getByTestId("product-card-primary-price");
    const secondary = getByTestId("product-card-secondary-price");
    expect(primary.textContent).toContain("L");
    expect(secondary.textContent).toContain("1,20");
    expect(secondary.textContent).not.toContain("L");
  });

  it("produto sem cheapestUnitPrice (comparisonUnit=UNIT) → sem secondary line", () => {
    const { getByTestId, queryByTestId } = renderWithProviders(
      <ProductCard
        product={makeProduct({
          comparisonUnit: "UNIT",
          cheapestUnitPrice: null,
        })}
      />,
    );
    expect(getByTestId("product-card-primary-price")).toBeTruthy();
    expect(queryByTestId("product-card-secondary-price")).toBeNull();
  });
});
