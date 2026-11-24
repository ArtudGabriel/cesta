import { describe, it, expect } from "vitest";
import { calculateDiscount } from "./discount";

describe("calculateDiscount", () => {
  it("retorna null quando previousPrice ausente", () => {
    expect(calculateDiscount({ previousPrice: null, currentPrice: 1 })).toBeNull();
  });

  it("retorna null quando currentPrice >= previousPrice", () => {
    expect(
      calculateDiscount({ previousPrice: 2, currentPrice: 2 }),
    ).toBeNull();
    expect(
      calculateDiscount({ previousPrice: 1.5, currentPrice: 2 }),
    ).toBeNull();
  });

  it("retorna percent correto arredondado", () => {
    // 2.00 → 1.50 = -25%
    expect(
      calculateDiscount({ previousPrice: 2, currentPrice: 1.5 }),
    ).toEqual({ percent: 25, severity: "mid" });
  });

  it("severity=low quando <15%", () => {
    // 10 → 9 = -10%
    const d = calculateDiscount({ previousPrice: 10, currentPrice: 9 });
    expect(d?.severity).toBe("low");
    expect(d?.percent).toBe(10);
  });

  it("severity=mid quando 15-29%", () => {
    // 10 → 8 = -20%
    const d = calculateDiscount({ previousPrice: 10, currentPrice: 8 });
    expect(d?.severity).toBe("mid");
  });

  it("severity=high quando >=30%", () => {
    // 10 → 5 = -50%
    const d = calculateDiscount({ previousPrice: 10, currentPrice: 5 });
    expect(d?.severity).toBe("high");
  });

  it("rejeita valores não-finitos ou <=0", () => {
    expect(
      calculateDiscount({ previousPrice: 0, currentPrice: 1 }),
    ).toBeNull();
    expect(
      calculateDiscount({ previousPrice: -1, currentPrice: 0.5 }),
    ).toBeNull();
    expect(
      calculateDiscount({ previousPrice: Number.NaN, currentPrice: 1 }),
    ).toBeNull();
  });

  it("boundary 15% exato cai em mid (inclusivo)", () => {
    // 100 → 85 = -15%
    const d = calculateDiscount({ previousPrice: 100, currentPrice: 85 });
    expect(d?.severity).toBe("mid");
    expect(d?.percent).toBe(15);
  });

  it("boundary 30% exato cai em high", () => {
    // 100 → 70 = -30%
    const d = calculateDiscount({ previousPrice: 100, currentPrice: 70 });
    expect(d?.severity).toBe("high");
    expect(d?.percent).toBe(30);
  });
});
