import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E — Sprint 198 infra setup.
 *
 * Env-aware baseURL:
 *   - PLAYWRIGHT_BASE_URL set → use it (CI preview deploy / prod empírico).
 *   - BASE_URL set → fallback (compat com a11y-audit script).
 *   - default localhost:3000 (dev local com `next dev` OU `next start` manual).
 *
 * Chromium-only em MVP; Firefox/WebKit expandir via projects[] quando user
 * reportar bug cross-browser (maioria mobile Chrome na Espanha).
 *
 * Trace:
 *   - retain-on-failure em CI (S201 bump — captura trace mesmo quando teste
 *     falha sem retry, e descarta em happy path pra manter artifact leve).
 *   - off em local (velocidade dev).
 *
 * Timeouts (S201):
 *   - test 30s, expect 5s (defaults razoáveis).
 *   - actionTimeout 10s + navigationTimeout 15s: cap explícito para click/
 *     fill/goto não herdar o test timeout inteiro quando backend está lento.
 *     Alinha com "timing retry se cesta-api lento" na DoD S201 — tests com
 *     mocks terminam bem abaixo disso; limite só morde em runs contra API
 *     real (preview deploy / prod empírico via PLAYWRIGHT_BASE_URL).
 *
 * Reporter:
 *   - list (stdout CI legível).
 *   - html (artifact pra GH Actions download).
 */
const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ??
  process.env.BASE_URL ??
  "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  // Sprint 202 AJUSTE Boss: workers=1 top-level (CI + local). Workers=6 local
  // causou flakiness (~2h loop debugando home.spec count=0 race de hydration
  // paralelo). Specs E2E compartilham next-server único + mocks state — não
  // são hermeticamente isolados entre workers. 1 worker trade-off serialização
  // por determinismo.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Sprint 243c (ADR 0045): WebKit iPhone pra validar refresh cookie
    // first-party sob ITP. Specs opt-in via grep `@webkit-iphone`.
    {
      name: "webkit-iphone",
      use: { ...devices["iPhone 13"] },
      grep: /@webkit-iphone/,
    },
  ],
});
