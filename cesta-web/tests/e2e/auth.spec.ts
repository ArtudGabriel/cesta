import { expect, test } from "@playwright/test";
import {
  DEFAULT_ACCESS_TOKEN as ACCESS_TOKEN,
  DEFAULT_USER_EMAIL as EMAIL,
  baseUser,
  envelope,
  fulfillJson,
  mockMeEndpoints,
  seedAuth,
} from "./helpers/auth";

/**
 * Sprint 201 — E2E auth flow expansion.
 * Sprint 202 — helpers extraídos pra tests/e2e/helpers/auth.ts (reuse em
 * favoritos.spec.ts + comparar.spec.ts).
 *
 * Cobre quatro flows essenciais:
 *   (a) register form valid + submit + auto-login redirect pra "/".
 *   (b) logout limpa session + /favoritos redireciona /login com returnUrl.
 *   (c) login existing + reload preserva session (zustand persist + access
 *       token em localStorage + cookie 15min).
 *   (d) i18n toggle em /perfil NÃO invalida session — regressão S168 P1
 *       (fixada em S169 via window.location.reload() pós-mutate que preserva
 *       auth cookie httpOnly em vez de router.refresh() client-nav).
 */

const PASSWORD = "SuperSecret123!";

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

    // AJUSTE 2 QA S201: wipe runtime (page.evaluate removeItem) era INÚTIL
    // porque seedAuth() usou page.addInitScript() — scripts init re-executam
    // ANTES de CADA page.goto(), re-semeando storage com user truthy antes
    // da página hidratar. Fix real: adicionar OUTRO addInitScript que roda
    // DEPOIS do seed (ordem de add respeitada) e sobrescreve com remove.
    // Além disso, context().clearCookies() mata cookie cesta_access_token
    // + cesta:locale pra garantia (init script roda inside page context,
    // não apaga cookies HTTP-only se houver — mas aqui não há, defensivo).
    await page.addInitScript(() => {
      try {
        window.localStorage.removeItem("cesta-auth");
        window.localStorage.removeItem("cesta_access_token");
      } catch {
        // storage pode falhar em modo privado/strict — teste assertiona depois.
      }
    });
    await page.context().clearCookies();

    // Guard /favoritos: useEffect isHydrated && !user → router.replace
    // /login?returnUrl=... Timeout 15s cobre hydration + effect tick.
    // Matcher via função pra extrair pathname/searchParams sem assumir
    // locale prefix (next-intl localePrefix:"never" bare em prod, pode
    // variar em setup QA port custom).
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
