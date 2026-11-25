import { describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils";
import { CompareMatrix } from "./compare-matrix";
import type { Product } from "../types/catalog.types";

function makeProduct(id: string, name: string, prices: Array<{ slug: string; name: string; price: number; available?: boolean }>): Product {
  return {
    id,
    name,
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
      onPromotion: false,
      previousPrice: null,
      isAvailable: p.available !== false,
      isStale: false,
      lastSyncedAt: new Date().toISOString(),
      confidenceScore: 1,
    })),
    cheapestSupermarketSlug:
      prices.find((p) => p.available !== false) != null
        ? prices.filter((p) => p.available !== false).sort((a, b) => a.price - b.price)[0]!.slug
        : null,
    cheapestPrice:
      prices.length > 0
        ? Math.min(...prices.filter((p) => p.available !== false).map((p) => p.price))
        : null,
    cheapestUnitPrice: null,
  };
}

describe("CompareMatrix (Sprint 131)", () => {
  it("renderiza linha por produto + coluna por supermarket ordenada asc avg", () => {
    const products = [
      makeProduct("p1", "Leche 1L", [
        { slug: "merc", name: "Mercadona", price: 0.95 },
        { slug: "dia", name: "DIA", price: 0.89 },
        { slug: "lidl", name: "LIDL", price: 0.98 },
      ]),
      makeProduct("p2", "Yogur pack 4", [
        { slug: "merc", name: "Mercadona", price: 1.85 },
        { slug: "dia", name: "DIA", price: 1.95 },
        { slug: "lidl", name: "LIDL", price: 1.75 },
      ]),
    ];

    const { getByTestId } = renderWithProviders(
      <CompareMatrix products={products} onRemove={() => undefined} />,
    );

    // Matrix rendered
    getByTestId("compare-matrix");
    getByTestId("compare-matrix-row-p1");
    getByTestId("compare-matrix-row-p2");

    // Cheapest cell p1 = DIA (0.89 < 0.95 < 0.98)
    const p1Dia = getByTestId("compare-matrix-cell-p1-dia");
    expect(p1Dia.getAttribute("data-cheapest")).toBe("true");
    const p1Merc = getByTestId("compare-matrix-cell-p1-merc");
    expect(p1Merc.getAttribute("data-cheapest")).toBeNull();

    // Cheapest cell p2 = LIDL (1.75 < 1.85 < 1.95)
    const p2Lidl = getByTestId("compare-matrix-cell-p2-lidl");
    expect(p2Lidl.getAttribute("data-cheapest")).toBe("true");
  });

  it("supermarkets ordered asc pelo preço médio nos produtos", () => {
    const products = [
      makeProduct("p1", "Leche", [
        { slug: "merc", name: "Mercadona", price: 1.0 },
        { slug: "dia", name: "DIA", price: 2.0 },
      ]),
      makeProduct("p2", "Pan", [
        { slug: "merc", name: "Mercadona", price: 1.5 },
        { slug: "dia", name: "DIA", price: 2.5 },
      ]),
    ];

    const { getByTestId, container } = renderWithProviders(
      <CompareMatrix products={products} onRemove={() => undefined} />,
    );
    getByTestId("compare-matrix");

    // Headers em ordem: Merc avg 1.25 < DIA avg 2.25
    const headers = container.querySelectorAll<HTMLElement>(
      '[data-testid^="compare-matrix-col-"]',
    );
    expect(headers.length).toBe(2);
    expect(headers[0].getAttribute("data-testid")).toBe(
      "compare-matrix-col-merc",
    );
    expect(headers[1].getAttribute("data-testid")).toBe(
      "compare-matrix-col-dia",
    );
  });

  it("onRemove chamado ao clicar botão X", () => {
    const products = [
      makeProduct("p1", "Leche", [{ slug: "merc", name: "Mercadona", price: 1 }]),
    ];
    const onRemove = vi.fn();
    const { getByLabelText } = renderWithProviders(
      <CompareMatrix products={products} onRemove={onRemove} />,
    );
    fireEvent.click(getByLabelText(/Eliminar|Remover/));
    expect(onRemove).toHaveBeenCalledWith("p1");
  });

  it("renderiza empty state quando produtos sem preços disponíveis", () => {
    const products = [
      makeProduct("p1", "Leche", []),
    ];
    const { getByTestId } = renderWithProviders(
      <CompareMatrix products={products} onRemove={() => undefined} />,
    );
    getByTestId("compare-matrix-empty");
  });

  // ────────────────────────────────────────────────────────────
  // Sprint 174 — matrix polish
  // ────────────────────────────────────────────────────────────

  it("S174: cheapest cell usa bg-lima/15 + text-cesta-green (§3.3 ganho=Lima)", () => {
    const products = [
      makeProduct("p1", "Leche", [
        { slug: "merc", name: "Mercadona", price: 1.0 },
        { slug: "car", name: "Carrefour", price: 1.5 },
      ]),
    ];
    const { getByTestId } = renderWithProviders(
      <CompareMatrix products={products} onRemove={() => undefined} />,
    );
    const cheapestCell = getByTestId("compare-matrix-cell-p1-merc");
    expect(cheapestCell.className).toMatch(/bg-lima\/15/);
    expect(cheapestCell.className).toMatch(/text-cesta-green/);
    expect(cheapestCell.getAttribute("data-cheapest")).toBe("true");
  });

  it("S174: unit price secondary cell renderiza quando price.unitPrice presente", () => {
    const products = [
      makeProduct("p1", "Leche 1L", [
        { slug: "merc", name: "Mercadona", price: 1.2 },
      ]),
    ];
    // Override unitPrice via mutating returned product (makeProduct passa null)
    products[0].prices[0] = {
      ...products[0].prices[0],
      unitPrice: { value: 1.2, unit: "L" },
    };
    const { getByTestId } = renderWithProviders(
      <CompareMatrix products={products} onRemove={() => undefined} />,
    );
    const unitCell = getByTestId("compare-matrix-cell-unit-p1-merc");
    expect(unitCell.textContent).toContain("1,20");
    expect(unitCell.textContent).toContain("L");
  });

  it("S174: sort toggle ASC→DESC inverte ordem colunas", () => {
    const products = [
      makeProduct("p1", "Leche", [
        { slug: "cheap", name: "Barato", price: 1.0 },
        { slug: "mid", name: "Médio", price: 2.0 },
        { slug: "exp", name: "Caro", price: 3.0 },
      ]),
    ];
    const { getByTestId, container } = renderWithProviders(
      <CompareMatrix products={products} onRemove={() => undefined} />,
    );
    // ASC: cheap, mid, exp
    let cols = container.querySelectorAll('[data-testid^="compare-matrix-col-"]');
    expect(cols[0].getAttribute("data-testid")).toBe("compare-matrix-col-cheap");
    expect(cols[2].getAttribute("data-testid")).toBe("compare-matrix-col-exp");

    fireEvent.click(getByTestId("compare-matrix-sort-toggle"));
    // DESC: exp, mid, cheap
    cols = container.querySelectorAll('[data-testid^="compare-matrix-col-"]');
    expect(cols[0].getAttribute("data-testid")).toBe("compare-matrix-col-exp");
    expect(cols[2].getAttribute("data-testid")).toBe("compare-matrix-col-cheap");
  });
});
