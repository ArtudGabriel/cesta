import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Sprint 166 — GDPR mask regression. Static source assertion garante que a
 * lista pessoal de favoritos em /favoritos page.tsx tem `data-sentry-mask`
 * conforme CLAUDE.md §GDPR/Privacy Sprint 59: "Novo componente que renderiza
 * PII do usuário DEVE ganhar data-sentry-mask no mesmo commit".
 *
 * Nota: static source test vs render test porque page.tsx depende de 6+
 * hooks (auth, profile, nutri, sort, router, search) cujo full mock
 * excederia valor regression. Diff de source garante o bit material.
 */
const PAGE_PATH = resolve(
  __dirname,
  "../../../app/[locale]/favoritos/page.tsx",
);
const EMPTY_STATE_PATH = resolve(__dirname, "./favorites-empty-state.tsx");

describe("Favorites GDPR + token (Sprint 166)", () => {
  it("favoritos/page.tsx lista <ul> tem data-sentry-mask", () => {
    const src = readFileSync(PAGE_PATH, "utf8");
    // lista principal (data-testid=favorites-list) deve ter data-sentry-mask
    expect(src).toMatch(
      /data-testid="favorites-list"[^]*?data-sentry-mask|data-sentry-mask[^]*?data-testid="favorites-list"/,
    );
  });

  it("favorites-empty-state Heart usa text-cesta-green (brand), não text-coral (destrutivo)", () => {
    const src = readFileSync(EMPTY_STATE_PATH, "utf8");
    // FavoritesEmptyState (com CTA) — Heart usa brand primary
    expect(src).toMatch(/text-cesta-green[^"]*" aria-hidden/);
    // Não deve ter Heart text-coral (semantic destrutivo reservado §3.3)
    expect(src).not.toMatch(/<Heart[^>]*text-coral/);
  });
});
