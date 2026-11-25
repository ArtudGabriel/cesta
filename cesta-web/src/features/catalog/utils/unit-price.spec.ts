import { describe, expect, it } from "vitest";
import { calcUnitPrice } from "./unit-price";

describe("calcUnitPrice (Sprint 165)", () => {
  it("LITER: 1.5L a €3,00 → €2,00 /L", () => {
    expect(calcUnitPrice(3.0, 1.5, "LITER")).toEqual({
      value: 2.0,
      unit: "L",
    });
  });

  it("KILOGRAM: 0.5kg a €4,50 → €9,00 /kg", () => {
    expect(calcUnitPrice(4.5, 0.5, "KILOGRAM")).toEqual({
      value: 9.0,
      unit: "kg",
    });
  });

  it("GRAM: 250g a €2,50 → €1,00 /100g", () => {
    expect(calcUnitPrice(2.5, 250, "GRAM")).toEqual({
      value: 1.0,
      unit: "100g",
    });
  });

  it("MILLILITER: 500ml a €3,00 → €0,60 /100ml", () => {
    expect(calcUnitPrice(3.0, 500, "MILLILITER")).toEqual({
      value: 0.6,
      unit: "100ml",
    });
  });

  it("UNIT: retorna null (preço absoluto já é unidade)", () => {
    expect(calcUnitPrice(1.2, 1, "UNIT")).toBeNull();
    expect(calcUnitPrice(5.0, 6, "UNIT")).toBeNull();
  });

  it("packageSize=0 → null (evita divisão por zero)", () => {
    expect(calcUnitPrice(3.0, 0, "LITER")).toBeNull();
  });

  it("packageSize negativo → null", () => {
    expect(calcUnitPrice(3.0, -1, "LITER")).toBeNull();
  });

  it("price=null → null", () => {
    expect(calcUnitPrice(null, 1.5, "LITER")).toBeNull();
  });

  it("packageSize=null → null", () => {
    expect(calcUnitPrice(3.0, null, "LITER")).toBeNull();
  });

  it("price=undefined → null", () => {
    expect(calcUnitPrice(undefined, 1.5, "LITER")).toBeNull();
  });

  it("NaN inputs → null", () => {
    expect(calcUnitPrice(NaN, 1.5, "LITER")).toBeNull();
    expect(calcUnitPrice(3.0, NaN, "LITER")).toBeNull();
  });

  it("Infinity inputs → null", () => {
    expect(calcUnitPrice(Infinity, 1.5, "LITER")).toBeNull();
  });

  it("arredondamento 2 casas decimais", () => {
    // 1.33 / 3 = 0.4433... → 0.44
    expect(calcUnitPrice(1.33, 3, "LITER")).toEqual({
      value: 0.44,
      unit: "L",
    });
  });
});
