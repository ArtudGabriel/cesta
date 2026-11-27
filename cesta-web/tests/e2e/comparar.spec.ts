import { expect, test, type Page } from "@playwright/test";
import { dismissCookieBanner, envelope, fulfillJson } from "./helpers/auth";
import type {
  PriceByMarket,
  Product,
} from "@/features/catalog/types/catalog.types";

/**
 * Sprint 202 — E2E /comparar flows.
 * Sprint 210 — MockPrice/MockProduct alias feature types (zero paralelo).
 *
 * (a) /comparar sem products → empty state + CTA "Explorar productos".
 * (b) /comparar?products=id1,id2 → matrix (ou grid) renderiza. SSR
 *     fetchCompareSSR degrada [] em falha (S202 app resilience patch),
 *     client useCompare refetcha /products/compare → Playwright intercepta.
 * (c) toggle view Precios ↔ Nutrición (radiogroup compare).
 * (d) winner highlight — modo Tabla (matrix) tem `data-cheapest="true"`
 *     na célula do preço mais barato por produto × supermercado.
 */

type MockPrice = PriceByMarket;
type MockProduct = Product;

function price(
  slug: string,
  name: string,
  value: number,
  overrides: Partial<MockPrice> = {},
): MockPrice {
  return {
    supermarketId: `sm-${slug}`,
    supermarketSlug: slug,
    supermarketName: name,
    supermarketColor: null,
    price: value,
    unitPrice: { value, unit: "L" },
    onPromotion: false,
    previousPrice: null,
    isAvailable: true,
    isStale: false,
    lastSyncedAt: "2026-11-26T00:00:00.000Z",
    confidenceScore: 1,
    ...overrides,
  };
}

function product(
  id: string,
  name: string,
  prices: MockPrice[],
): MockProduct {
  const cheapest = [...prices].sort((a, b) => a.price - b.price)[0] ?? null;
  return {
    id,
    name,
    brand: "Hacendado",
    imageUrl: null,
    categoryId: null,
    packageSize: 1,
    packageUnit: "LITER",
    comparisonUnit: "LITER",
    calories: 60,
    protein: 3.5,
    fat: 1.5,
    saturatedFat: 1.0,
    carbs: 5.0,
    sugar: 4.8,
    salt: 0.1,
    fiber: 0,
    nutritionPer: 100,
    nutriScore: { score: 5, grade: "B" },
    isVegan: false,
    isVegetarian: true,
    isGlutenFree: true,
    isLactoseFree: false,
    prices,
    cheapestSupermarketSlug: cheapest?.supermarketSlug ?? null,
    cheapestPrice: cheapest?.price ?? null,
    cheapestUnitPrice: cheapest?.unitPrice ?? null,
    isStale: cheapest?.isStale ?? false,
  };
}

async function mockCompare(page: Page, products: MockProduct[]) {
  await page.route("**/products/compare*", async (route) => {
    await fulfillJson(route, 200, envelope(products));
  });
  // Fetch de supermarkets (useSupermarkets hook, usado em compare-matrix).
  await page.route("**/supermarkets*", async (route) => {
    await fulfillJson(
      route,
      200,
      envelope(
        [
          { slug: "mercadona", name: "Mercadona" },
          { slug: "dia", name: "DIA" },
          { slug: "carrefour", name: "Carrefour" },
        ].map((s, i) => ({
          id: `sm-${s.slug}`,
          slug: s.slug,
          name: s.name,
          color: null,
          logoUrl: null,
          website: null,
          isActive: true,
          order: i,
        })),
      ),
    );
  });
}

test.describe("Comparar flows (route interception)", () => {
  test.beforeEach(async ({ page }) => {
    await dismissCookieBanner(page);
  });

  test("(a) /comparar sem products → empty state CTA explorar", async ({
    page,
  }) => {
    await mockCompare(page, []);
    await page.goto("/comparar");

    const empty = page.getByTestId("comparison-empty-state");
    await expect(empty).toBeVisible({ timeout: 10_000 });

    const cta = page.getByTestId("comparison-empty-cta-explore");
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/");
  });

  test("(b) /comparar?products=id1,id2 → matrix renderiza", async ({
    page,
  }) => {
    const p1 = product("prod-1", "Leche Entera 1L", [
      price("mercadona", "Mercadona", 1.1),
      price("dia", "DIA", 1.25),
      price("carrefour", "Carrefour", 1.3),
    ]);
    const p2 = product("prod-2", "Leche Desnatada 1L", [
      price("mercadona", "Mercadona", 1.15),
      price("dia", "DIA", 1.05),
      price("carrefour", "Carrefour", 1.4),
    ]);
    await mockCompare(page, [p1, p2]);

    // SSR fetchCompareSSR falhará (API offline em e2e workflow); page.tsx
    // S202 patch degrada pra initialData=[]. CompareClient omite initialData
    // quando vazio → useCompare client-side refetcha → mock responde.
    await page.goto("/comparar?products=prod-1,prod-2");

    // Default view "prices" (grid). Clicar Tabla ativa o matrix.
    const matrixRadio = page.getByRole("radio", { name: /^tabla$/i });
    await expect(matrixRadio).toBeVisible({ timeout: 15_000 });
    await matrixRadio.click();

    const matrix = page.getByTestId("compare-matrix");
    await expect(matrix).toBeVisible({ timeout: 10_000 });
    // 2 produtos (rows) presentes.
    await expect(
      page.getByTestId("compare-matrix-row-prod-1"),
    ).toBeVisible();
    await expect(
      page.getByTestId("compare-matrix-row-prod-2"),
    ).toBeVisible();
  });

  test("(c) toggle Precios ↔ Nutrición view", async ({ page }) => {
    const p1 = product("prod-1", "Leche Entera 1L", [
      price("mercadona", "Mercadona", 1.1),
      price("dia", "DIA", 1.25),
    ]);
    const p2 = product("prod-2", "Leche Desnatada 1L", [
      price("mercadona", "Mercadona", 1.15),
      price("dia", "DIA", 1.05),
    ]);
    await mockCompare(page, [p1, p2]);

    await page.goto("/comparar?products=prod-1,prod-2");

    const precios = page.getByRole("radio", { name: /^precios$/i });
    const nutricion = page.getByRole("radio", { name: /nutrici[oó]n/i });
    await expect(precios).toBeVisible({ timeout: 15_000 });

    // Default: "Precios" ativo (aria-checked="true").
    await expect(precios).toHaveAttribute("aria-checked", "true");
    await expect(nutricion).toHaveAttribute("aria-checked", "false");

    // Toggle para Nutrición.
    await nutricion.click();
    await expect(nutricion).toHaveAttribute("aria-checked", "true");
    await expect(precios).toHaveAttribute("aria-checked", "false");
  });

  test("(d) winner highlight — cheapest cell data-cheapest=true", async ({
    page,
  }) => {
    // Preços construídos pra cheapest determinístico:
    //   prod-1 cheapest = mercadona (1.10)
    //   prod-2 cheapest = dia (1.05)
    const p1 = product("prod-1", "Leche Entera 1L", [
      price("mercadona", "Mercadona", 1.1),
      price("dia", "DIA", 1.25),
      price("carrefour", "Carrefour", 1.3),
    ]);
    const p2 = product("prod-2", "Leche Desnatada 1L", [
      price("mercadona", "Mercadona", 1.15),
      price("dia", "DIA", 1.05),
      price("carrefour", "Carrefour", 1.4),
    ]);
    await mockCompare(page, [p1, p2]);

    await page.goto("/comparar?products=prod-1,prod-2");
    await page.getByRole("radio", { name: /^tabla$/i }).click();

    const matrix = page.getByTestId("compare-matrix");
    await expect(matrix).toBeVisible({ timeout: 15_000 });

    // prod-1 cheapest = mercadona.
    const cellP1Merc = page.getByTestId(
      "compare-matrix-cell-prod-1-mercadona",
    );
    await expect(cellP1Merc).toHaveAttribute("data-cheapest", "true");

    // prod-2 cheapest = dia.
    const cellP2Dia = page.getByTestId("compare-matrix-cell-prod-2-dia");
    await expect(cellP2Dia).toHaveAttribute("data-cheapest", "true");

    // Cells não-cheapest NÃO têm o attr (undefined — getAttribute null).
    const cellP1Dia = page.getByTestId("compare-matrix-cell-prod-1-dia");
    await expect(cellP1Dia).not.toHaveAttribute("data-cheapest", "true");
  });

  test("(e) /comparar?products=X (single id) → empty state, no infinite spinner (S215)", async ({
    page,
  }) => {
    // S215 P0 regression: React Query v5 reporta isPending=true quando
    // enabled:false (ids.length<2 desabilita useCompare). Guard antigo
    // `isPending && ids.length>0` matchava com 1 id → loader infinito.
    // Fix: guard por ids.length<2 primeiro em compare-client.tsx.
    await mockCompare(page, []);
    await page.goto("/comparar?products=prod-1");

    const empty = page.getByTestId("comparison-empty-state");
    await expect(empty).toBeVisible({ timeout: 10_000 });

    // Loader NÃO deve aparecer — antes da fix ficaria infinito.
    const loader = page.locator(".animate-spin");
    await expect(loader).toHaveCount(0);
  });
});
