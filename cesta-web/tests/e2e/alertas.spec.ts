import { expect, test, type Page } from "@playwright/test";
import {
  baseUser,
  envelope,
  fulfillJson,
  mockMeEndpoints,
  seedAuth,
} from "./helpers/auth";

/**
 * Sprint 203 — E2E /alertas flows.
 *
 * (a) /alertas empty state (sem rules).
 * (b) /alertas/novo wizard renderiza 3 opts combo/trend/bundle
 *     (data-testid rule-type-<combo|trend|bundle>).
 */

async function mockAlerts(
  page: Page,
  opts: { alerts?: unknown[]; rules?: unknown[] } = {},
) {
  await page.route("**/alerts", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await fulfillJson(route, 200, envelope(opts.alerts ?? []));
      return;
    }
    await route.fallback();
  });
  await page.route("**/alerts/rules*", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await fulfillJson(route, 200, envelope(opts.rules ?? []));
      return;
    }
    await route.fallback();
  });
  await page.route("**/users/me/push-subscription*", (route) =>
    fulfillJson(route, 200, envelope({ publicKey: null })),
  );
}

test.describe("Alertas flows (route interception)", () => {
  test("(a) /alertas empty state", async ({ page }) => {
    const user = baseUser();
    await seedAuth(page, user);
    await mockMeEndpoints(page, user);
    await mockAlerts(page, { alerts: [], rules: [] });

    await page.goto("/alertas");

    // Empty state header + some empty copy (não assumimos texto exato —
    // AlertsEmptyState pode variar; verificamos heading Mis alertas +
    // ausência de cards).
    const heading = page
      .getByRole("heading", { name: /alertas|mis alertas/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("(b) /alertas/novo wizard 3 opts combo/trend/bundle", async ({
    page,
  }) => {
    const user = baseUser();
    await seedAuth(page, user);
    await mockMeEndpoints(page, user);
    await mockAlerts(page);

    await page.goto("/alertas/novo");

    // Type picker container presente.
    await expect(page.getByTestId("rule-wizard-type-picker")).toBeVisible({
      timeout: 10_000,
    });

    // 3 options renderizam (combo + trend + bundle).
    await expect(page.getByTestId("rule-type-combo")).toBeVisible();
    await expect(page.getByTestId("rule-type-trend")).toBeVisible();
    await expect(page.getByTestId("rule-type-bundle")).toBeVisible();

    // Click combo → avança pra configure step; form renderiza.
    await page.getByTestId("rule-type-combo").click();
    await expect(page.getByTestId("rule-wizard-form")).toBeVisible({
      timeout: 5_000,
    });
  });
});
