import { expect, test } from "@playwright/test";
import type { Schemas } from "@/types/api";
import {
  DEFAULT_ACCESS_TOKEN as ACCESS_TOKEN,
  DEFAULT_USER_EMAIL as EMAIL,
  baseUser,
  envelope,
  fulfillJson,
  mockMeEndpoints,
} from "./helpers/auth";

/**
 * Sprint 243c (ADR 0045) — auth transport first-party via Next rewrite.
 *
 * DoD vinculante Boss: 4 passos end-to-end sob WebKit iPhone (ITP ativo)
 * provando que o refresh cookie first-party sobrevive expiração do access
 * e que a nova ação logada renova sozinha sem modal LoginGate.
 *
 * Mock strategy: route interception sobre `**\/api/v1/...` (NÃO sobre o
 * upstream direto cesta-gsvc.onrender.com). Pós-rewrite o client bate
 * em caminho relativo (same-origin), então o path é
 * `${BASE_URL}/api/v1/...`. Isso casa `**\/api/v1/*` em qualquer
 * baseURL.
 *
 * Marker `@webkit-iphone` restringe a execução ao project `webkit-iphone`
 * (configurado em playwright.config.ts). Chromium project ignora via
 * grep inverso (sem marker = chrome).
 */

const PASSWORD = "SuperSecret123!";
const FRESH_ACCESS_TOKEN = "e2e-fresh-access-after-refresh";

test.describe("Auth refresh cookie first-party (ADR 0045)", () => {
  test("@webkit-iphone DoD: login → upload → expire access → next action renova sem modal", async ({
    page,
    context,
  }) => {
    const user = baseUser();

    // Rota mock /auth/login — responde com user + accessToken. Simula
    // refresh cookie first-party setando-o manualmente via context
    // (Playwright respeita o cookie no próximo request).
    await page.route("**/api/v1/auth/login", async (route) => {
      expect(route.request().method()).toBe("POST");
      // Sprint 243c: refresh cookie vem sem Domain attr → Playwright
      // atribui ao baseURL host (same-origin). Mimic via addCookies.
      const baseURL = page.url().startsWith("http")
        ? new URL(page.url())
        : null;
      if (baseURL) {
        await context.addCookies([
          {
            name: "refresh_token",
            value: "e2e-refresh-v1",
            domain: baseURL.hostname,
            path: "/",
            httpOnly: true,
            secure: baseURL.protocol === "https:",
            sameSite: "Lax",
            expires: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
          },
        ]);
      }
      await fulfillJson(
        route,
        200,
        envelope({ user, tokens: { accessToken: ACCESS_TOKEN, expiresIn: 900 } }),
      );
    });
    await mockMeEndpoints(page, user);

    // Passo 2: upload recibo com access válido.
    let uploadCalls = 0;
    await page.route("**/api/v1/receipts", async (route) => {
      uploadCalls += 1;
      const method = route.request().method();
      if (method === "POST") {
        const authHeader = route.request().headers()["authorization"];
        expect(authHeader).toBe(`Bearer ${ACCESS_TOKEN}`);
        await fulfillJson(
          route,
          202,
          envelope({ jobId: "e2e-job-1", receiptId: "r-1", status: "pending" }),
        );
        return;
      }
      // GET /api/v1/receipts — listagem; Passo 4 depois do refresh deve
      // vir com o token NOVO.
      const authHeader = route.request().headers()["authorization"];
      if (authHeader === `Bearer ${ACCESS_TOKEN}`) {
        // Primeira tentativa pós-expiração: axios ainda envia stale token
        // porque localStorage foi apagado, mas aqui mockamos pra testar
        // apenas o path pós-refresh. Retornamos 401 pra forçar refresh.
        await fulfillJson(
          route,
          401,
          { message: "Token inválido", errorCode: "AUTH.TOKEN_INVALID" },
        );
        return;
      }
      if (authHeader === `Bearer ${FRESH_ACCESS_TOKEN}`) {
        await fulfillJson(route, 200, envelope([]));
        return;
      }
      // Sem Authorization (localStorage apagado) → 401 dispara refresh.
      await fulfillJson(
        route,
        401,
        { message: "Token ausente", errorCode: "AUTH.TOKEN_MISSING" },
      );
    });

    // Passo 3+4: refresh endpoint retorna novo access. Validamos que o
    // cookie refresh_token first-party CHEGOU ao servidor (mock) — se
    // SameSite=lax + cross-site, não chegaria (pré-S243c bug).
    let refreshCalls = 0;
    await page.route("**/api/v1/auth/refresh", async (route) => {
      refreshCalls += 1;
      const cookieHeader = route.request().headers()["cookie"] ?? "";
      expect(cookieHeader).toContain("refresh_token=e2e-refresh-v1");
      await fulfillJson(
        route,
        200,
        envelope({ user, tokens: { accessToken: FRESH_ACCESS_TOKEN, expiresIn: 900 } }),
      );
    });

    // --- Passo 1: Login ---
    await page.goto("/login");
    await page.locator("#email").fill(EMAIL);
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: /iniciar sesión|entrar|login/i }).click();
    await page.waitForURL("/");

    // Access token populado via setAccessToken (localStorage + document.cookie).
    const accessAfterLogin = await page.evaluate(() =>
      window.localStorage.getItem("cesta_access_token"),
    );
    expect(accessAfterLogin).toBe(ACCESS_TOKEN);

    // --- Passo 2: Upload ticket ---
    await page.goto("/gastos");
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "ticket.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00]),
    });
    // Upload dispara /api/v1/receipts POST. Wait pra que o axios
    // tenha sido invocado.
    await page.waitForFunction(() => true);
    expect(uploadCalls).toBeGreaterThanOrEqual(1);

    // --- Passo 3: Expirar access token ---
    await page.evaluate(() => {
      window.localStorage.removeItem("cesta_access_token");
      document.cookie = "cesta_access_token=; path=/; max-age=0; samesite=lax";
    });

    // --- Passo 4: Nova ação logada. Deve renovar via refresh sem modal. ---
    await page.goto("/gastos");
    // LoginGate modal NÃO deve aparecer — refresh deve entregar FRESH_ACCESS_TOKEN
    // e axios retry entregar 200.
    await expect(page.getByTestId("login-gate-modal")).toHaveCount(0, {
      timeout: 5_000,
    });
    expect(refreshCalls).toBeGreaterThanOrEqual(1);

    // Token fresco salvo em localStorage pós-refresh (lib/api.ts
    // setAccessToken).
    const accessAfterRefresh = await page.evaluate(() =>
      window.localStorage.getItem("cesta_access_token"),
    );
    expect(accessAfterRefresh).toBe(FRESH_ACCESS_TOKEN);
  });
});
