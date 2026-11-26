import { expect, type Page, type Route } from "@playwright/test";

/**
 * Sprint 202 — shared E2E helpers extracted from auth.spec.ts (S201).
 *
 * Centraliza fixture pattern (seed auth storage pre-navigation + mock
 * /auth/me + /users/me) pra reuso em favoritos.spec.ts + comparar.spec.ts
 * + futuras suites.
 *
 * Route interception strategy — ver README "Playwright E2E" seção Fixtures.
 */

export interface MockUser {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  locale: "es" | "pt-BR";
  roles: string[];
  emailVerifiedAt: string | null;
  createdAt: string;
}

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
 * Pre-seeds zustand + access token BEFORE the first navigation. Uses
 * addInitScript so the app boots already authenticated. Note: init scripts
 * re-run on EVERY page.goto — if a test needs to logout + re-nav, it must
 * add a new init script with removeItem to override this seed (see
 * S201 AJUSTE 2 fix em auth.spec.ts flow (b)).
 */
export async function seedAuth(
  page: Page,
  user: MockUser = baseUser(),
  token: string = DEFAULT_ACCESS_TOKEN,
) {
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
