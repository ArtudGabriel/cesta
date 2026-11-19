import { describe, it, expect } from "vitest";
import { formatUnitPrice } from "./format-unit-price";

describe("formatUnitPrice", () => {
  it("formata { value: 4.2, unit: L } em es", () => {
    const str = formatUnitPrice({ value: 4.2, unit: "L" }, "es");
    expect(str).toBe("4,20 €/L");
  });

  it("null -> null", () => {
    expect(formatUnitPrice(null, "es")).toBeNull();
    expect(formatUnitPrice(undefined, "es")).toBeNull();
  });

  it("unit kg em es", () => {
    expect(formatUnitPrice({ value: 1.5, unit: "kg" }, "es")).toBe("1,50 €/kg");
  });

  it("unit un em pt-BR", () => {
    const str = formatUnitPrice({ value: 0.2, unit: "un" }, "pt-BR");
    expect(str).toContain("/un");
    expect(str).toContain("0,20");
  });

  // Sprint 118 — regressão: style:'currency' em pt-BR prependava "€ 4,20"
  // enquanto es-ES appendava "4,20 €". A saída tem que terminar com " €/{unit}"
  // (single € no mesmo lugar) em ambos locales.
  it("formato consistente entre locales (single € sufixo)", () => {
    expect(formatUnitPrice({ value: 4.2, unit: "L" }, "es")).toBe("4,20 €/L");
    expect(formatUnitPrice({ value: 4.2, unit: "L" }, "pt-BR")).toBe("4,20 €/L");
  });

  it("nunca duplica € (regressão PDP mobile)", () => {
    const esStr = formatUnitPrice({ value: 1.5, unit: "kg" }, "es") ?? "";
    const ptStr = formatUnitPrice({ value: 1.5, unit: "kg" }, "pt-BR") ?? "";
    expect((esStr.match(/€/g) ?? []).length).toBe(1);
    expect((ptStr.match(/€/g) ?? []).length).toBe(1);
  });
});
