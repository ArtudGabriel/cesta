import { expect, type Page, type Route } from "@playwright/test";
import type { AuthUser } from "@/features/auth/types/auth.types";

/**
 * Sprint 202 — shared E2E helpers extracted from auth.spec.ts (S201).
 * Sprint 210 — MockUser alias de AuthUser (feature type, shape canônica).
 *
 * Centraliza fixture pattern (seed auth storage pre-navigation + mock
 * /auth/me + /users/me) pra reuso em favoritos.spec.ts + comparar.spec.ts
 * + futuras suites.
 *
 * Route interception strategy — ver README "Playwright E2E" seção Fixtures.
 */

export type MockUser = AuthUser;

export const DEFAULT_ACCESS_TOKEN = "e2e-access-token-xyz";
export const DEFAULT_USER_EMAIL = "e2e@cesta.test";

export function baseUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "user-e2e-1",
    email: DEFAULT_USER_EMAIL,
    phone: null,
    name: "E2E Tester",
    locale: "es",
    roles: ["USER"],
    emailVerifiedAt: "2026-11-26T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function envelope<T>(data: T) {
  return { data };
}

export async function fulfillJson(
  route: Route,
  status: number,
  body: unknown,
) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

/**
 * Pre-dismiss cookie-consent banner via `cesta:consent=essential` cookie.
 * Sprint 202 AJUSTE: QA flow (c) regex catava "Aceptar todo" do
 * CookieBanner no DOM antes do ConfirmDialog real. Dismissing o banner
 * remove o overlay das queries subsequentes.
 *
 * Reuse-safe: called antes de page.goto. localePrefix:"never" + cookie
 * é como o app real reconhece preferência (ver features/consent/hooks/
 * use-consent.ts L13 pattern `cesta:consent=(all|essential)`).
 */
export async function dismissCookieBanner(page: Page) {
  await page.addInitScript(() => {
    try {
      document.cookie =
        "cesta:consent=essential; path=/; max-age=31536000; samesite=lax";
    } catch {
      // cookie API falha em modos restritos — teste segue, banner pode
      // reaparecer e assertions específicas lidam com a presença.
    }
  });
}

/**
 * Pre-seeds zustand + access token BEFORE the first navigation. Uses
 * addInitScript so the app boots already authenticated. Note: init scripts
 * re-run on EVERY page.goto — if a test needs to logout + re-nav, it must
 * add a new init script with removeItem to override this seed (see
 * S201 AJUSTE 2 fix em auth.spec.ts flow (b)).
 *
 * Sprint 202 AJUSTE: também dispara dismissCookieBanner (todo user autenticado
 * no e2e já é considerado post-consent — matches prod default UX).
 */
export async function seedAuth(
  page: Page,
  user: MockUser = baseUser(),
  token: string = DEFAULT_ACCESS_TOKEN,
) {
  await dismissCookieBanner(page);
  await page.addInitScript(
    ({ user, token }) => {
      try {
        window.localStorage.setItem(
          "cesta-auth",
          JSON.stringify({ state: { user }, version: 0 }),
        );
        window.localStorage.setItem("cesta_access_token", token);
        document.cookie = `cesta_access_token=${token}; path=/; max-age=900; samesite=lax`;
        document.cookie = `cesta:locale=${user.locale}; path=/; max-age=31536000; samesite=lax`;
      } catch {
        // storage pode falhar em modo privado/strict — teste assertiona depois.
      }
    },
    { user, token },
  );
}

/**
 * Intercepta /auth/me + /users/me (GET + PATCH) com o user atual.
 * useMe + useProfile hooks hit these endpoints on mount + after mutations.
 */
export async function mockMeEndpoints(page: Page, user: MockUser) {
  await page.route("**/auth/me", async (route) => {
    await fulfillJson(route, 200, envelope(user));
  });
  await page.route("**/users/me", async (route) => {
    if (route.request().method() === "PATCH") {
      let body: Record<string, unknown> = {};
      try {
        body = (await route.request().postDataJSON()) as Record<string, unknown>;
      } catch {
        // payload não-JSON — ignore e devolve user atual.
      }
      const next: MockUser = { ...user, ...body } as MockUser;
      await fulfillJson(route, 200, envelope(next));
      return;
    }
    await fulfillJson(route, 200, envelope(user));
  });
}

// Re-export expect so specs can `import { expect } from './helpers/auth'`
// if they prefer a single import — optional, not required.
export { expect };
