import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Sprint 170 — regression static source: /perfil header tem botão logout
 * icon above-the-fold. S168 P3 QA audit flagou user precisava scroll
 * ~1000px pra achar Cerrar sesión no fim da página.
 *
 * Static assertion ao invés de render test porque page.tsx tem 6+ hooks
 * (auth, profile, nutri, logout, router, sync) cujo mock full excederia
 * valor regression.
 */
const PAGE_PATH = resolve(__dirname, "./page.tsx");

describe("/perfil header logout (Sprint 170)", () => {
  it("header contém botão logout com data-testid=perfil-header-logout", () => {
    const src = readFileSync(PAGE_PATH, "utf8");
    expect(src).toContain('data-testid="perfil-header-logout"');
  });

  it("botão logout header chama logout.mutate (não só link)", () => {
    const src = readFileSync(PAGE_PATH, "utf8");
    // Localiza linha ou proximidade do testid e assert onClick → logout.mutate
    const idx = src.indexOf('data-testid="perfil-header-logout"');
    expect(idx).toBeGreaterThan(-1);
    const slice = src.slice(Math.max(0, idx - 500), idx + 500);
    expect(slice).toMatch(/onClick=\{\(\)\s*=>\s*logout\.mutate\(\)\}/);
  });
});
