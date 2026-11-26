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
 *   - on-first-retry em CI (debug playbook sem overhead em happy path).
 *   - off em local (velocidade dev).
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
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
