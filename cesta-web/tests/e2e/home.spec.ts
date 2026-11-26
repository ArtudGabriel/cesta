import { expect, test } from "@playwright/test";

/**
 * Sprint 198 — primeiro smoke E2E Playwright.
 *
 * Objetivo: validar wiring Playwright + Next (baseURL + chromium headless +
 * trace on-failure). Assertions mínimas pra não depender de backend específico
 * (CI web job offline API = suggestions dropdown pode estar vazio mas estrutura
 * UI renderiza).
 *
 * S199+ expand cobrirá: fuzzy suggest com backend live, /produto PDP, flow
 * compare, login/register journey (pós prod restored).
 */
test.describe("Home (smoke)", () => {
  test("home carrega + search combobox visível + typing abre dropdown", async ({
    page,
  }) => {
    await page.goto("/");

    // Page title Cesta
    await expect(page).toHaveTitle(/Cesta/i);

    // Search combobox renderizado (role="combobox" ARIA, SearchBar component).
    const search = page.getByRole("combobox").first();
    await expect(search).toBeVisible();

    // Type ≥2 chars (threshold minimum pra disparar useSuggestions query).
    await search.fill("leche");

    // Suggestions dropdown abre (role="listbox" markup). Backend offline em CI
    // pode retornar array vazio, mas o listbox element deve montar apenas
    // pela presença de ≥2 chars no input (keep placeholder data from React
    // Query). Fallback assertion: ARIA aria-expanded="true" OR listbox DOM
    // presence — ambos sinalizam dropdown aberto corretamente.
    const combobox = page.getByRole("combobox").first();
    await expect(combobox).toHaveAttribute("aria-expanded", "true", {
      timeout: 5_000,
    });
  });

  test("home renderiza nav principal + footer hooks", async ({ page }) => {
    await page.goto("/");
    // Navigation role present (BottomNav em mobile ou header nav em desktop).
    // Qualquer link role suffices pra confirmar page hydrate.
    const links = page.getByRole("link");
    expect(await links.count()).toBeGreaterThan(0);
  });
});
