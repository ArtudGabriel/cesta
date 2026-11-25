import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Sprint 169 — regression static source check pra garantir que o handler
 * pickLocale em /perfil NÃO usa router.refresh() (que disparava race com
 * useProfile revalidation + useEffect auth guard, causando redirect
 * falso-positivo pra /login — bug P1 S168 QA audit). Substitui por
 * window.location.reload() que preserva auth cookie httpOnly + força
 * re-leitura de cesta:locale pelo middleware next-intl.
 *
 * Static assertion ao invés de render test porque perfil/page.tsx tem 6+
 * hooks (auth, profile, nutri, logout, router, sync) e mockar todos
 * excederia valor regression. Validar o bit material via source diff basta.
 */
const PAGE_PATH = resolve(__dirname, "./page.tsx");

describe("/perfil pickLocale handler (Sprint 169)", () => {
  it("pickLocale usa window.location.reload (não router.refresh)", () => {
    const src = readFileSync(PAGE_PATH, "utf8");
    const pickLocaleStart = src.indexOf("function pickLocale");
    expect(pickLocaleStart).toBeGreaterThan(-1);
    const handlerSlice = src.slice(pickLocaleStart, pickLocaleStart + 1500);
    expect(handlerSlice).toContain("window.location.reload()");
    // Strip comentários (// linha, /* bloco */) antes de verificar ausência
    // do call expression router.refresh(. Garante que não há call real,
    // ainda que comentário mencione o call (documentando o fix).
    const stripped = handlerSlice
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(stripped).not.toMatch(/router\.refresh\s*\(/);
  });

  it("pickLocale ainda seta cookie cesta:locale (next-intl leitura server-side)", () => {
    const src = readFileSync(PAGE_PATH, "utf8");
    expect(src).toMatch(/document\.cookie\s*=\s*`cesta:locale=/);
  });
});
