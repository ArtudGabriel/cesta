import { expect, test, type Page } from "@playwright/test";
import {
  baseUser,
  envelope,
  fulfillJson,
  mockMeEndpoints,
  seedAuth,
} from "./helpers/auth";
import type { Favorite } from "@/features/favorites/types/favorite.types";

/**
 * Sprint 202 — E2E favoritos flows (reuse seedAuth S201 helpers).
 * Sprint 210 — mock shapes importam feature types (zero paralelo).
 *
 * (a) logged navega /favoritos renderiza grid OU empty state.
 * (b) adicionar favorito via API (simula FavoriteToggle do PDP/grid) → /favoritos
 *     reflete o novo item. PDP SSR requer backend; mockamos endpoints HTTP
 *     que o useAddFavorite hook invoca pra provar o ciclo de dados sem
 *     depender de rota /produto/[pid] com backend live.
 * (c) unfavorite optimistic — clicar Heart no cartão abre confirm dialog
 *     (S88 destructive gate), confirm → card some instant (useRemoveFavorite
 *     onMutate remove do cache antes do POST).
 * (d) GDPR mask — favoritos-list tem data-sentry-mask (regra Sprint 59
 *     memory `GDPR / Privacy S59` em CLAUDE.md).
 */

function fav(id: string, productId: string, name: string): Favorite {
  return {
    id,
    productId,
    createdAt: "2026-11-26T00:00:00.000Z",
    product: {
      id: productId,
      name,
      brand: "Hacendado",
      imageUrl: null,
      isVegan: false,
      isVegetarian: true,
      isGlutenFree: false,
      isLactoseFree: false,
      nutriScore: { score: 10, grade: "B" },
    },
    cheapestPrice: {
      price: 1.25,
      supermarketSlug: "mercadona",
      supermarketName: "Mercadona",
      unitPrice: { value: 1.25, unit: "L" },
      isStale: false,
    },
  };
}

/**
 * Mock stateful /favorites endpoints. `initial` seeds list; subsequent
 * POST/DELETE mutations update the server-side state so GET reflects changes.
 */
async function mockFavoritesCrud(
  page: Page,
  opts: { initial: Favorite[] } = { initial: [] },
) {
  const state: Favorite[] = [...opts.initial];

  await page.route("**/favorites", async (route) => {
    const method = route.request().method();
    if (method === "POST") {
      let body: { productId?: string } = {};
      try {
        body = (await route.request().postDataJSON()) as { productId?: string };
      } catch {
        // invalid JSON — devolve 400 real-like.
        await fulfillJson(route, 400, { message: "invalid payload" });
        return;
      }
      const newFav = fav(
        `fav-${Date.now()}`,
        body.productId ?? "prod-unknown",
        "Produto Adicionado",
      );
      state.unshift(newFav);
      await fulfillJson(route, 201, envelope(newFav));
      return;
    }
    await fulfillJson(route, 200, envelope(state));
  });

  await page.route("**/favorites/*", async (route) => {
    const method = route.request().method();
    if (method === "DELETE") {
      const url = new URL(route.request().url());
      const productId = url.pathname.split("/").pop() ?? "";
      const idx = state.findIndex((f) => f.productId === productId);
      if (idx >= 0) state.splice(idx, 1);
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    await fulfillJson(route, 200, envelope(state));
  });

  await page.route("**/favorites/check*", async (route) => {
    const url = new URL(route.request().url());
    const ids = (url.searchParams.get("productIds") ?? "").split(",").filter(Boolean);
    const favorited = ids.filter((id) => state.some((f) => f.productId === id));
    await fulfillJson(route, 200, envelope({ favorited }));
  });

  return { state };
}

test.describe("Favoritos flows (route interception)", () => {
  test("(a) logged navega /favoritos renderiza grid OU empty state", async ({
    page,
  }) => {
    const user = baseUser();
    await seedAuth(page, user);
    await mockMeEndpoints(page, user);
    await mockFavoritesCrud(page, { initial: [] });

    await page.goto("/favoritos");

    // Empty state renderiza quando lista vazia. FavoritesEmptyState tem
    // texto "Aún no tienes favoritos" (ES default).
    await expect(
      page.getByText(/a[uú]n no tienes favoritos/i).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Heading "Mis favoritos" sempre presente (chrome).
    await expect(
      page.getByRole("heading", { name: /mis favoritos/i }),
    ).toBeVisible();
  });

  test("(b) adicionar favorito reflete em /favoritos", async ({ page }) => {
    const user = baseUser();
    await seedAuth(page, user);
    await mockMeEndpoints(page, user);
    const { state } = await mockFavoritesCrud(page, { initial: [] });

    // Prime empty.
    await page.goto("/favoritos");
    await expect(
      page.getByText(/a[uú]n no tienes favoritos/i).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Seed via API (simula FavoriteToggle onPDP → POST /favorites).
    // Executamos a POST do próprio browser context — passa pela
    // mesma route interception que o app usa.
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
    const response = await page.evaluate(
      async ({ url, token }) => {
        const r = await fetch(`${url}/favorites`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ productId: "prod-leche-1" }),
        });
        return { status: r.status };
      },
      { url: apiBase, token: "e2e-access-token-xyz" },
    );
    expect(response.status).toBe(201);
    expect(state.length).toBe(1);

    // Re-navega /favoritos (useFavorites refetcha). List visible agora.
    await page.goto("/favoritos");
    const list = page.getByTestId("favorites-list");
    await expect(list).toBeVisible({ timeout: 10_000 });
    await expect(list.locator("li")).toHaveCount(1);
  });

  test("(c) unfavorite optimistic — card some instant", async ({ page }) => {
    const user = baseUser();
    const seedFav = fav("fav-1", "prod-leche-1", "Leche Entera 1L");
    await seedAuth(page, user);
    await mockMeEndpoints(page, user);
    await mockFavoritesCrud(page, { initial: [seedFav] });

    await page.goto("/favoritos");
    const list = page.getByTestId("favorites-list");
    await expect(list).toBeVisible({ timeout: 10_000 });
    await expect(list.locator("li")).toHaveCount(1);

    // Clicar Heart no cartão abre ConfirmDialog (S88 destructive gate).
    // FavoriteToggle usa aria-label="Quitar de favoritos" (favoriteRemove
    // key no namespace common.aria) quando isFavorite=true.
    const heartBtn = list
      .getByRole("button", { name: /quitar de favoritos|remove favorite/i })
      .first();
    await heartBtn.click();

    // Dialog destructive — ConfirmDialog usa role="alertdialog".
    // S202 AJUSTE QA: regex anterior incluía 'aceptar' que casava com
    // "Aceptar todo" do CookieBanner. Fix: (1) seedAuth já dismissa banner
    // via cookie cesta:consent, (2) scope busca ao role=dialog pra garantir
    // escopo correto mesmo se banner reaparecer.
    const dialog = page.getByRole("dialog").last();
    const confirmBtn = dialog.getByRole("button", {
      name: /eliminar|quitar|confirmar|remover/i,
    });
    await confirmBtn.click();

    // onMutate do useRemoveFavorite remove do cache IMEDIATAMENTE antes
    // da response do DELETE — card deve sumir em <1s (sem refetch).
    await expect(list.locator("li")).toHaveCount(0, { timeout: 2_000 });
  });

  test("(d) GDPR mask data-sentry-mask presente em favoritos-list (S59)", async ({
    page,
  }) => {
    const user = baseUser();
    const seedFav = fav("fav-1", "prod-leche-1", "Leche Entera 1L");
    await seedAuth(page, user);
    await mockMeEndpoints(page, user);
    await mockFavoritesCrud(page, { initial: [seedFav] });

    await page.goto("/favoritos");
    const list = page.getByTestId("favorites-list");
    await expect(list).toBeVisible({ timeout: 10_000 });

    // S59 compliance: data-sentry-mask presente no <ul> da lista de
    // favoritos (Session Replay não grava conteúdo). Regra non-negotiable
    // em CLAUDE.md "GDPR / Privacy (Sprint 59)".
    await expect(list).toHaveAttribute("data-sentry-mask", /.*/);
  });
});
