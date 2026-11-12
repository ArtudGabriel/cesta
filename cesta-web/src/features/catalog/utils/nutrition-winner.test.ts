import { describe, it, expect } from "vitest";
import { computeWinnerSets, pickBest } from "./nutrition-winner";

describe("pickBest", () => {
  it("lower-is-better: retorna id do menor valor em sugar", () => {
    const products = [
      { id: "a", sugar: 10 },
      { id: "b", sugar: 5 },
      { id: "c", sugar: 12 },
    ];
    expect(pickBest(products, "sugar")).toBe("b");
  });

  it("higher-is-better: retorna id do maior valor em fiber", () => {
    const products = [
      { id: "a", fiber: 2 },
      { id: "b", fiber: 5 },
      { id: "c", fiber: 3.5 },
    ];
    expect(pickBest(products, "fiber")).toBe("b");
  });

  it("empate no melhor valor retorna null", () => {
    const products = [
      { id: "a", sugar: 5 },
      { id: "b", sugar: 5 },
      { id: "c", sugar: 10 },
    ];
    expect(pickBest(products, "sugar")).toBeNull();
  });

  it("menos de 2 valores numericos retorna null", () => {
    const products = [
      { id: "a", sugar: 5 },
      { id: "b", sugar: null },
      { id: "c", sugar: null },
    ];
    expect(pickBest(products, "sugar")).toBeNull();
  });
});

describe("computeWinnerSets", () => {
  it("distribui winners por nutriente em 3 produtos", () => {
    const sets = computeWinnerSets([
      { id: "a", sugar: 10, fiber: 2, protein: 5, calories: 100 },
      { id: "b", sugar: 5, fiber: 2, protein: 10, calories: 150 },
      { id: "c", sugar: 8, fiber: 3, protein: 8, calories: 120 },
    ]);
    expect(sets.get("b")?.has("sugar")).toBe(true);
    expect(sets.get("c")?.has("fiber")).toBe(true);
    expect(sets.get("b")?.has("protein")).toBe(true);
    expect(sets.get("a")?.has("calories")).toBe(true);
  });

  it("empate exclui nutriente (A=B=5 vs C=10, lower-is-better)", () => {
    const sets = computeWinnerSets([
      { id: "a", sugar: 5 },
      { id: "b", sugar: 5 },
      { id: "c", sugar: 10 },
    ]);
    expect(sets.get("a")?.has("sugar")).toBe(false);
    expect(sets.get("b")?.has("sugar")).toBe(false);
    expect(sets.get("c")?.has("sugar")).toBe(false);
  });
});
