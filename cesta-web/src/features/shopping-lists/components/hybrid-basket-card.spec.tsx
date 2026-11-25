import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils";
import { HybridBasketCard } from "./hybrid-basket-card";
import type {
  HybridItem,
  ListTotals,
  SupermarketTotal,
} from "../types/shopping-list.types";

function makeHybridItem(overrides: Partial<HybridItem> = {}): HybridItem {
  return {
    productId: "p-leche",
    productName: "Leche entera 1L",
    quantity: 1,
    supermarketSlug: "mercadona",
    supermarketName: "Mercadona",
    supermarketColor: "#1a7f3e",
    unitPrice: 1.2,
    subtotal: 1.2,
    onPromotion: false,
    ...overrides,
  };
}

function makeMarket(overrides: Partial<SupermarketTotal> = {}): SupermarketTotal {
  return {
    supermarketId: "s-mer",
    supermarketSlug: "mercadona",
    supermarketName: "Mercadona",
    supermarketColor: "#1a7f3e",
    total: 10,
    availableItems: 3,
    missingItems: 0,
    itemsBreakdown: [],
    ...overrides,
  };
}

function makeTotals(overrides: Partial<ListTotals> = {}): ListTotals {
  return {
    bySupermarket: [makeMarket()],
    cheapestSupermarketSlug: "mercadona",
    cheapestTotal: 10,
    mostExpensiveTotal: 12,
    savingsVsMostExpensive: 2,
    hybridItems: [makeHybridItem()],
    hybridTotal: 1.2,
    hybridSavings: 0.3,
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("HybridBasketCard (Sprint 163)", () => {
  it("renderiza nada quando hybridItems vazio", () => {
    const { container } = renderWithProviders(
      <HybridBasketCard totals={makeTotals({ hybridItems: [] })} />,
    );
    expect(container.querySelector('[data-testid="hybrid-basket-card"]')).toBeNull();
  });

  it("renderiza items + total + savings", () => {
    const { getByTestId, getByText } = renderWithProviders(
      <HybridBasketCard totals={makeTotals()} />,
    );
    expect(getByTestId("hybrid-basket-card")).toBeTruthy();
    expect(getByTestId("hybrid-items-list")).toBeTruthy();
    expect(getByTestId("hybrid-item-p-leche")).toBeTruthy();
    expect(getByTestId("hybrid-total")).toBeTruthy();
    expect(getByTestId("hybrid-savings")).toBeTruthy();
    expect(getByText("Leche entera 1L")).toBeTruthy();
  });

  it("renderiza promo badge quando onPromotion=true", () => {
    const { getByTestId } = renderWithProviders(
      <HybridBasketCard
        totals={makeTotals({
          hybridItems: [makeHybridItem({ onPromotion: true })],
        })}
      />,
    );
    expect(getByTestId("hybrid-item-promo-p-leche")).toBeTruthy();
  });

  it("não renderiza savings quando hybridSavings=0", () => {
    const { queryByTestId } = renderWithProviders(
      <HybridBasketCard totals={makeTotals({ hybridSavings: 0 })} />,
    );
    expect(queryByTestId("hybrid-savings")).toBeNull();
  });

  it("item tap → Link href /produto/:productId", () => {
    const { getByTestId } = renderWithProviders(
      <HybridBasketCard totals={makeTotals()} />,
    );
    const item = getByTestId("hybrid-item-p-leche");
    const link = item.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/produto/p-leche");
  });

  it("usa supermarketName do market (não slug) na mensagem de savings", () => {
    const { getByTestId } = renderWithProviders(
      <HybridBasketCard totals={makeTotals()} />,
    );
    const saving = getByTestId("hybrid-savings");
    expect(saving.textContent).toContain("Mercadona");
  });
});
