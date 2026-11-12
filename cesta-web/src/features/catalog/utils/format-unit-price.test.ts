import { describe, it, expect } from "vitest";
import { formatUnitPrice } from "./format-unit-price";

describe("formatUnitPrice", () => {
  it("formata { value: 4.2, unit: L } em es", () => {
    const str = formatUnitPrice({ value: 4.2, unit: "L" }, "es");
    expect(str).toBe("4,20 €/L");
  });

  it("null -> null", () => {
    expect(formatUnitPrice(null, "es")).toBeNull();
    expect(formatUnitPrice(undefined, "es")).toBeNull();
  });

  it("unit kg em es", () => {
    expect(formatUnitPrice({ value: 1.5, unit: "kg" }, "es")).toBe("1,50 €/kg");
  });

  it("unit un em pt-BR", () => {
    const str = formatUnitPrice({ value: 0.2, unit: "un" }, "pt-BR");
    expect(str).toContain("/un");
    expect(str).toContain("0,20");
  });
});
