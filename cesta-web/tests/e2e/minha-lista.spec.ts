import { expect, test, type Page } from "@playwright/test";
import {
  baseUser,
  envelope,
  fulfillJson,
  mockMeEndpoints,
  seedAuth,
} from "./helpers/auth";
import type { ShoppingList } from "@/features/shopping-lists/types/shopping-list.types";

/**
 * Sprint 203 — E2E /minha-lista flows.
 * Sprint 210 — MockShoppingList = Omit<ShoppingList,"items"> (shape canônica
 * reuse; mocks cobrem só root card fields).
 *
 * (a) empty state + CTA "Crear nueva lista".
 * (b) criar lista → POST /shopping-lists → redirect /minha-lista/:id
 *     (detail SSR 404-friendly: assertion foca em URL change, não conteúdo
 *     detail — SSR gating documentado em README "S203+ roadmap").
 * (c) totals por mercado: lista com cheapestTotal exibe preço + "desde"
 *     label no card top-level de /minha-lista.
 *
 * "Add produto" (parte do DoD b) requer detail page SSR — SKIPPED por
 * mesmo gating (fetchListSSR não resiliente como comparar; S20X candidate).
 */

const CUID_SAMPLE = "clzlist00000111111111111111";

type MockShoppingList = Omit<ShoppingList, "items">;

function list(
  id: string,
  name: string,
  overrides: Partial<MockShoppingList> = {},
): MockShoppingList {
  return {
    id,
    name,
    itemCount: 0,
    cheapestTotal: null,
    cheapestSupermarketSlug: null,
    createdAt: "2026-11-26T00:00:00.000Z",
    updatedAt: "2026-11-26T00:00:00.000Z",
    ...overrides,
  };
}

async function mockShoppingLists(
  page: Page,
  opts: { initial: MockShoppingList[] } = { initial: [] },
) {
  const state: MockShoppingList[] = [...opts.initial];

  await page.route("**/shopping-lists", async (route) => {
    const method = route.request().method();
    if (method === "POST") {
      let body: { name?: string } = {};
      try {
        body = (await route.request().postDataJSON()) as { name?: string };
      } catch {
        await fulfillJson(route, 400, { message: "invalid payload" });
        return;
      }
      const created = list(CUID_SAMPLE, body.name ?? "Lista Nueva");
      state.unshift(created);
      await fulfillJson(route, 201, envelope(created));
      return;
    }
    await fulfillJson(route, 200, envelope(state));
  });

  return { state };
}

test.describe("Minha-lista flows (route interception)", () => {
  test("(a) empty state + CTA criar nueva lista", async ({ page }) => {
    const user = baseUser();
    await seedAuth(page, user);
    await mockMeEndpoints(page, user);
    await mockShoppingLists(page, { initial: [] });

    await page.goto("/minha-lista");

    // Empty state copy "Aún no tienes listas." (ES default).
    await expect(
      page.getByText(/a[uú]n no tienes listas/i).first(),
    ).toBeVisible({ timeout: 10_000 });

    // CTA "Crear nueva lista" (ES).
    const cta = page.getByRole("button", {
      name: /crear nueva lista/i,
    });
    await expect(cta).toBeVisible();
  });

  test("(b) criar lista → POST + redirect /minha-lista/:id", async ({
    page,
  }) => {
    const user = baseUser();
    await seedAuth(page, user);
    await mockMeEndpoints(page, user);
    const { state } = await mockShoppingLists(page, { initial: [] });

    await page.goto("/minha-lista");

    // Click CTA → form aparece com Input + Button "Crear".
    await page.getByRole("button", { name: /crear nueva lista/i }).click();

    const input = page.getByPlaceholder(/nombre de la lista/i);
    await expect(input).toBeVisible();
    await input.fill("Lista Semanal");

    // Click confirm "Crear" (botão à direita do input).
    await page.getByRole("button", { name: /^crear$/i }).click();

    // POST /shopping-lists fires → mock state updated → redirect
    // /minha-lista/<id>. Detail SSR notFound() sem backend; URL assertion OK.
    await page.waitForURL(new RegExp(`/minha-lista/${CUID_SAMPLE}`), {
      timeout: 10_000,
    });

    expect(state.length).toBe(1);
    expect(state[0].name).toBe("Lista Semanal");
  });

  test("(c) totals por mercado visíveis no card", async ({ page }) => {
    const user = baseUser();
    const seeded = list(CUID_SAMPLE, "Compras Mes", {
      itemCount: 8,
      cheapestTotal: 24.5,
      cheapestSupermarketSlug: "mercadona",
    });
    await seedAuth(page, user);
    await mockMeEndpoints(page, user);
    await mockShoppingLists(page, { initial: [seeded] });

    await page.goto("/minha-lista");

    // Card renderiza com nome + itemCount + preço cheapestTotal.
    await expect(
      page.getByRole("heading", { name: /compras mes/i, level: 3 }),
    ).toBeVisible({ timeout: 10_000 });

    // Preço cheapestTotal formatado (locale ES: 24,50 €).
    await expect(
      page.getByText(/24[,.]50\s*€|€\s*24[,.]50/i).first(),
    ).toBeVisible();

    // Label "desde" (fromPrice ES).
    await expect(page.getByText(/^desde$/i).first()).toBeVisible();
  });
});
