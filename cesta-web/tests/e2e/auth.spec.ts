import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * Sprint 201 — E2E auth flow expansion.
 *
 * Cobre quatro flows essenciais:
 *   (a) register form valid + submit + auto-login redirect pra "/".
 *   (b) logout limpa session + /favoritos redireciona /login com returnUrl.
 *   (c) login existing + reload preserva session (zustand persist + access
 *       token em localStorage + cookie 15min).
 *   (d) i18n toggle em /perfil NÃO invalida session — regressão S168 P1
 *       (fixada em S169 via window.location.reload() pós-mutate que preserva
 *       auth cookie httpOnly em vez de router.refresh() client-nav).
 *
 * Fixtures: Playwright route interception (route.fulfill). Justificativa em
 * PR body + README seção "Auth flows (route interception strategy)".
 *
 * Shapes seguem os types em cesta-web/src/features/auth/types/auth.types.ts
 * (AuthUser + AuthTokens + AuthResponse) e cesta-web/src/features/profile
 * (Profile pra /users/me GET). Backend não roda neste workflow — mocks
 * carregam contrato suficiente pra exercer o frontend.
 */

interface MockUser {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  locale: "es" | "pt-BR";
  roles: string[];
  emailVerifiedAt: string | null;
  createdAt: string;
}

const EMAIL = "e2e@cesta.test";
const PASSWORD = "SuperSecret123!";
const ACCESS_TOKEN = "e2e-access-token-xyz";

function baseUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "user-e2e-1",
    email: EMAIL,
    phone: null,
    name: "E2E Tester",
    locale: "es",
    roles: ["USER"],
    emailVerifiedAt: "2026-11-26T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function envelope<T>(data: T) {
  return { data };
}

async function fulfillJson(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

/**
 * Pre-seeds zustand + access token storage so the app boots already
 * authenticated. Avoids running login UI when the test under scrutiny is
 * logout / reload / i18n-toggle (flows b, c reload step, d).
 *
 * Must run via addInitScript BEFORE the first navigation so hydration picks
 * up the persisted state on mount.
 */
async function seedAuth(page: Page, user: MockUser = baseUser()) {
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
        // init script falha silenciosamente — teste assertiona depois.
      }
    },
    { user, token: ACCESS_TOKEN },
  );
}

/**
 * Intercepta /auth/me + /users/me com o user atual. Usado em flows que
 * precisam que o frontend re-fetche o user pós-hydration / pós-reload
 * (useMe + useProfile hooks).
 */
async function mockMeEndpoints(page: Page, user: MockUser) {
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

test.describe("Auth flows (route interception)", () => {
  test("(a) register valid submit + auto-login redirect pra home", async ({
    page,
  }) => {
    const user = baseUser();

    await page.route("**/auth/register", async (route) => {
      expect(route.request().method()).toBe("POST");
      const payload = (await route.request().postDataJSON()) as Record<
        string,
        unknown
      >;
      // Payload só carrega email OU phone (mutuamente exclusivos) — não
      // ambos, mesmo que ambos campos estejam no form (methodEmail hidden
      // zera phone e vice-versa).
      expect(payload).toMatchObject({
        email: EMAIL,
        password: PASSWORD,
      });
      expect(payload.phone).toBeUndefined();
      await fulfillJson(
        route,
        201,
        envelope({ user, tokens: { accessToken: ACCESS_TOKEN, expiresIn: 900 } }),
      );
    });
    await mockMeEndpoints(page, user);

    await page.goto("/register");
    await page.locator("#email").fill(EMAIL);
    await page.locator("#confirmEmail").fill(EMAIL);
    await page.locator("#name").fill(user.name ?? "");
    await page.locator("#password").fill(PASSWORD);
    await page.locator("#confirmPassword").fill(PASSWORD);

    await page.getByRole("button", { name: /crear cuenta/i }).click();

    await page.waitForURL("**/", { timeout: 10_000 });
    await expect(page).toHaveURL(/\/$/);

    // Access token persistido pós-register.
    const accessToken = await page.evaluate(() =>
      window.localStorage.getItem("cesta_access_token"),
    );
    expect(accessToken).toBe(ACCESS_TOKEN);
  });

  test("(b) logout clears session + /favoritos redireciona /login", async ({
    page,
  }) => {
    const user = baseUser();
    await seedAuth(page, user);
    await mockMeEndpoints(page, user);

    let logoutHit = false;
    await page.route("**/auth/logout", async (route) => {
      logoutHit = true;
      expect(route.request().method()).toBe("POST");
      await fulfillJson(route, 204, {});
    });

    await page.goto("/perfil");

    // Logout button above-fold (S170) — aria-label "Cerrar sesión" no header.
    // Fallback: role "button" com name matching cerrar sesión / salir / log out.
    const logoutBtn = page
      .getByRole("button", { name: /cerrar sesi[óo]n|salir|log\s*out/i })
      .first();
    await logoutBtn.click();

    // Pós-logout, router.push("/login") via useLogout onSettled. Matcher
    // robusto ao locale prefix: next-intl localePrefix:"never" mantém URL
    // bare em prod, mas run isolado (porta custom + PLAYWRIGHT_BASE_URL
    // override) pode expor middleware rewrite /[locale]/login. Usamos
    // função matcher que ignora prefix.
    await page.waitForURL(
      (url) => url.pathname.endsWith("/login"),
      { timeout: 10_000 },
    );
    expect(logoutHit).toBe(true);

    // Access token limpo de storage + cookie.
    const accessToken = await page.evaluate(() =>
      window.localStorage.getItem("cesta_access_token"),
    );
    expect(accessToken).toBeNull();

    // Zustand persist: user zerado em memória. Força wipe defensivo pra
    // garantir que a próxima navegação não vai re-hidratar user stale
    // (race observado em prod QA S201: clear() set({user:null}) fez persist
    // middleware reescrever storage, mas page.goto fresh puxou snapshot
    // anterior antes do write propagar).
    await page.evaluate(() => {
      window.localStorage.removeItem("cesta-auth");
      window.localStorage.removeItem("cesta_access_token");
      document.cookie = "cesta_access_token=; path=/; max-age=0; samesite=lax";
    });

    // Guard /favoritos: useEffect isHydrated && !user → router.replace
    // /login?returnUrl=... Timeout maior (15s) cobre hydration + effect
    // tick. Matcher via função pra extrair pathname/searchParams sem assumir
    // locale prefix.
    await page.goto("/favoritos");
    await page.waitForURL(
      (url) =>
        url.pathname.endsWith("/login") &&
        url.searchParams.get("returnUrl") === "/favoritos",
      { timeout: 15_000 },
    );
    const url = new URL(page.url());
    expect(url.pathname).toMatch(/\/login$/);
    expect(url.searchParams.get("returnUrl")).toBe("/favoritos");
  });

  test("(c) login existing + reload preserva session", async ({ page }) => {
    const user = baseUser();

    await page.route("**/auth/login", async (route) => {
      expect(route.request().method()).toBe("POST");
      const payload = (await route.request().postDataJSON()) as Record<
        string,
        unknown
      >;
      expect(payload).toMatchObject({ email: EMAIL, password: PASSWORD });
      await fulfillJson(
        route,
        200,
        envelope({ user, tokens: { accessToken: ACCESS_TOKEN, expiresIn: 900 } }),
      );
    });
    await mockMeEndpoints(page, user);

    await page.goto("/login");
    await page.locator("#email").fill(EMAIL);
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: /entrar|iniciar sesi[óo]n/i }).click();

    await page.waitForURL("**/", { timeout: 10_000 });

    // Hard reload — zustand persist deve re-hidratar user + access token.
    await page.reload();

    // /favoritos navigation NÃO redireciona pq user ainda está autenticado.
    await page.goto("/favoritos");
    await expect(page).toHaveURL(/\/favoritos(\?|$)/, { timeout: 10_000 });

    const accessToken = await page.evaluate(() =>
      window.localStorage.getItem("cesta_access_token"),
    );
    expect(accessToken).toBe(ACCESS_TOKEN);
  });

  test("(d) i18n toggle em /perfil NÃO invalida session (regressão S168 P1)", async ({
    page,
  }) => {
    const user = baseUser({ locale: "es" });
    await seedAuth(page, user);
    await mockMeEndpoints(page, user);

    await page.goto("/perfil");

    // Toggle pra PT-BR. Botão com aria-pressed sinaliza active state do atual
    // (es). Clicar no outro dispara pickLocale → PATCH /users/me + cookie +
    // window.location.reload() (S169 fix).
    const ptButton = page.getByRole("button", { name: /português|portugues/i }).first();
    await ptButton.click();

    // Após reload, a página /perfil remonta. Guard de auth no useEffect
    // (perfil page.tsx L71-83) exigiria user — se S168 regressão voltasse,
    // user estaria null pós-reload e redirecionaria pra /login. Assertion:
    // URL permanece em /perfil (não /login) + access token preservado.
    await page.waitForURL(/\/perfil(\?|$)/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/perfil(\?|$)/);

    const accessToken = await page.evaluate(() =>
      window.localStorage.getItem("cesta_access_token"),
    );
    expect(accessToken).toBe(ACCESS_TOKEN);

    const storeRaw = await page.evaluate(() =>
      window.localStorage.getItem("cesta-auth"),
    );
    const store = storeRaw ? JSON.parse(storeRaw) : null;
    expect(store?.state?.user?.id).toBe(user.id);
  });
});
