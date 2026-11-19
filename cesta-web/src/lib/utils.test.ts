import { describe, expect, it } from "vitest";
import { formatPrice } from "./utils";

// Sprint 118 — formatPrice tem que render "X,XX €" (sufixo) em qualquer
// locale. Antes, style:'currency' + pt-BR dava "€ X,XX" (prefixo) → no PDP,
// preço principal e unit price ficavam com o símbolo em lados diferentes e
// o usuário percebia o € "duplicado" ao bater o olho.
describe("formatPrice (S118)", () => {
  it("es-ES: single € sufixo", () => {
    expect(formatPrice(4.2, "es-ES")).toBe("4,20 €");
  });

  it("pt-BR: single € sufixo (sem prefixo)", () => {
    const s = formatPrice(4.2, "pt-BR");
    expect(s).toBe("4,20 €");
    expect((s.match(/€/g) ?? []).length).toBe(1);
  });

  it("default locale = es-ES", () => {
    expect(formatPrice(1.5)).toBe("1,50 €");
  });
});
