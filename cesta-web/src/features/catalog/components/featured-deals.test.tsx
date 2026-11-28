import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { FeaturedDeals } from "./featured-deals";
import * as service from "../services/featured-deals.service";
import type { Product } from "../types/catalog.types";

const messages = {
  home: {
    featured: {
      title: "Mejores ofertas",
      subtitle: "Mayor diferencia entre supermercados",
      cheaperAt: "Más barato en {market}",
    },
    discountOff: "-{percent}%",
    discountOffAria: "Descuento del {percent} por ciento",
  },
};

function makeProduct(
  id: string,
  prices: Array<{
    slug: string;
    name: string;
    price: number;
    available?: boolean;
    previousPrice?: number | null;
    onPromotion?: boolean;
  }>,
): Product {
  return {
    id,
    name: `Prod ${id}`,
    brand: null,
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
    prices: prices.map((p) => ({
      supermarketId: p.slug,
      supermarketSlug: p.slug,
      supermarketName: p.name,
      supermarketColor: null,
      price: p.price,
      unitPrice: null,
      onPromotion: p.onPromotion ?? false,
      previousPrice: p.previousPrice ?? null,
      isAvailable: p.available !== false,
      isStale: false,
      lastSyncedAt: new Date().toISOString(),
      confidenceScore: 1,
    })),
    cheapestSupermarketSlug: prices[0]?.slug ?? null,
    cheapestPrice: prices.length > 0 ? Math.min(...prices.map((p) => p.price)) : null,
    cheapestUnitPrice: null,
    isStale: false,
    canonicalProductId: null,
    canonicalGroupSize: 1,
    isSameProduct: false,
    equivalentGroupId: null,
    equivalentCount: 1,
  };
}

function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="es" messages={messages}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("FeaturedDeals (Sprint 132)", () => {
  it("renderiza top deals com savings % e cheapest supermarket", async () => {
    vi.spyOn(service.featuredDealsService, "fetch").mockResolvedValue([
      makeProduct("big", [
        { slug: "merc", name: "Mercadona", price: 1.0 },
        { slug: "aldi", name: "Aldi", price: 4.0 },
      ]),
      makeProduct("mid", [
        { slug: "merc", name: "Mercadona", price: 1.0 },
        { slug: "dia", name: "DIA", price: 2.0 },
      ]),
    ]);

    const renderResult = renderWithProviders(<FeaturedDeals limit={10} />);
    const { findByTestId } = renderResult;

    await findByTestId("featured-deal-big");
    await findByTestId("featured-deal-mid");
    // Savings badge: big = (3.0 / 4.0) * 100 = 75% off
    const bigCard = await findByTestId("featured-deal-big");
    expect(bigCard.textContent).toContain("-75%");
    // Cheapest supermarket label (2 cards, 2 labels — getAllByText aceita múltiplos)
    const { getAllByText } = renderResult;
    expect(getAllByText(/Más barato en Mercadona/).length).toBeGreaterThanOrEqual(1);
  });

  it("não renderiza nada quando zero deals qualificados", async () => {
    vi.spyOn(service.featuredDealsService, "fetch").mockResolvedValue([
      // Solo supermarket, sem previousPrice → spread=0 → não qualifica
      makeProduct("solo", [{ slug: "merc", name: "Mercadona", price: 1.0 }]),
    ]);

    const { queryByTestId } = renderWithProviders(
      <FeaturedDeals limit={10} />,
    );

    // Aguarda hook resolver + render decidir não mostrar
    await new Promise((r) => setTimeout(r, 50));
    expect(queryByTestId("featured-deals-section")).toBeNull();
  });

  it("Sprint 157: single-super com previousPrice qualifica (uses prev como high)", async () => {
    vi.spyOn(service.featuredDealsService, "fetch").mockResolvedValue([
      makeProduct("aceite-promo", [
        {
          slug: "merc",
          name: "Mercadona",
          price: 1.85,
          previousPrice: 8.6,
          onPromotion: true,
        },
      ]),
    ]);

    const { findByTestId } = renderWithProviders(
      <FeaturedDeals limit={10} />,
    );
    const card = await findByTestId("featured-deal-aceite-promo");
    // savings = (8.6 - 1.85) / 8.6 ≈ 78.49% → -78%
    expect(card.textContent).toContain("-78%");
  });
});
