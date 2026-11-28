import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils";
import { BasketCategoryGroups } from "./basket-category-group";
import type { BasketItem } from "../types/family-basket.types";

const categoriesMock = [
  {
    id: "c-lact",
    slug: "lacteos",
    nameEs: "Lácteos",
    namePt: "Laticínios",
    parentId: null,
    order: 1,
  },
  {
    id: "c-pan",
    slug: "panaderia",
    nameEs: "Panadería",
    namePt: "Padaria",
    parentId: null,
    order: 2,
  },
];

vi.mock("@/features/catalog/hooks/use-catalog", () => ({
  useCategories: () => ({ data: categoriesMock }),
}));

vi.mock("@/hooks/use-locale", () => ({
  useLocale: () => "es",
}));

function makeItem(overrides: Partial<BasketItem> & { subtotal: number }): BasketItem {
  const base: BasketItem = {
    id: `i-${Math.random().toString(36).slice(2, 7)}`,
    productId: "p-1",
    quantity: 1,
    unitPrice: 1,
    subtotal: 1,
    isRequired: false,
    isLocked: false,
    position: 0,
    product: {
      id: "p-1",
      name: "Leche",
      brand: null,
      imageUrl: null,
      categoryId: "c-lact",
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
      prices: [],
      cheapestSupermarketSlug: null,
      cheapestPrice: null,
      cheapestUnitPrice: null,
      isStale: false,
      canonicalProductId: null,
      canonicalGroupSize: 1,
      isSameProduct: false,
    },
  };
  return { ...base, ...overrides };
}

describe("BasketCategoryGroups (Sprint 173)", () => {
  it("agrupa items por categoryId + ordena DESC por total subtotal", () => {
    const items: BasketItem[] = [
      // Panaderia total = 2 (menor)
      makeItem({ id: "pan-1", subtotal: 2, product: { ...makeItem({ subtotal: 0 }).product, categoryId: "c-pan", name: "Pan" } }),
      // Lacteos total = 5 (maior)
      makeItem({ id: "lact-1", subtotal: 3, product: { ...makeItem({ subtotal: 0 }).product, categoryId: "c-lact", name: "Leche A" } }),
      makeItem({ id: "lact-2", subtotal: 2, product: { ...makeItem({ subtotal: 0 }).product, categoryId: "c-lact", name: "Leche B" } }),
    ];

    const { getByTestId, container } = renderWithProviders(
      <BasketCategoryGroups
        items={items}
        renderItem={(item) => <span>{item.product.name}</span>}
      />,
    );

    expect(getByTestId("basket-category-group-c-lact")).toBeTruthy();
    expect(getByTestId("basket-category-group-c-pan")).toBeTruthy();

    // Ordem: Lácteos primeiro (maior total), Panadería depois
    const groups = container.querySelectorAll(
      '[data-testid^="basket-category-group-"]',
    );
    expect(groups[0].getAttribute("data-testid")).toBe(
      "basket-category-group-c-lact",
    );
    expect(groups[1].getAttribute("data-testid")).toBe(
      "basket-category-group-c-pan",
    );
  });

  it("items com categoryId inexistente OU null → bucket __other__ com label 'Otros'", () => {
    const items: BasketItem[] = [
      makeItem({ id: "orphan", subtotal: 1, product: { ...makeItem({ subtotal: 0 }).product, categoryId: null } }),
    ];

    const { getByTestId, getByText } = renderWithProviders(
      <BasketCategoryGroups
        items={items}
        renderItem={(item) => <span>{item.product.name}</span>}
      />,
    );

    expect(getByTestId("basket-category-group-__other__")).toBeTruthy();
    expect(getByText("Otros")).toBeTruthy();
  });

  it("render total formatado em euros no header de cada grupo", () => {
    const items: BasketItem[] = [
      makeItem({ id: "lact-1", subtotal: 3.5, product: { ...makeItem({ subtotal: 0 }).product, categoryId: "c-lact" } }),
    ];

    const { getByTestId } = renderWithProviders(
      <BasketCategoryGroups
        items={items}
        renderItem={(item) => <span>{item.product.name}</span>}
      />,
    );

    const group = getByTestId("basket-category-group-c-lact");
    expect(group.textContent).toMatch(/3,50/);
  });
});
