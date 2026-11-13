import { describe, expect, it } from "vitest";
import { parseAcceptLanguage } from "./parse-accept-language";

describe("parseAcceptLanguage", () => {
  it('"pt-BR,pt;q=0.9,en;q=0.8" → "pt-BR"', () => {
    expect(parseAcceptLanguage("pt-BR,pt;q=0.9,en;q=0.8")).toBe("pt-BR");
  });

  it('"es-ES,es;q=0.9,en;q=0.8" → "es"', () => {
    expect(parseAcceptLanguage("es-ES,es;q=0.9,en;q=0.8")).toBe("es");
  });

  it('"fr-FR,en;q=0.8" → null (nenhum match)', () => {
    expect(parseAcceptLanguage("fr-FR,en;q=0.8")).toBe(null);
  });

  it("null/undefined/empty → null", () => {
    expect(parseAcceptLanguage(null)).toBe(null);
    expect(parseAcceptLanguage(undefined)).toBe(null);
    expect(parseAcceptLanguage("")).toBe(null);
  });

  it("respeita q= pra priorizar", () => {
    // en primeiro na ordem mas pt-BR com q maior deve ganhar
    expect(parseAcceptLanguage("en;q=0.5,pt-BR;q=0.9")).toBe("pt-BR");
  });
});
