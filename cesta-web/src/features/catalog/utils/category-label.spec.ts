import { describe, expect, it } from "vitest";
import { categoryLabel } from "./category-label";
import type { Category } from "@/features/catalog/types/catalog.types";

const cat = (over: Partial<Category> = {}): Category => ({
  id: "c1",
  slug: "lacteos",
  nameEs: "Lácteos",
  namePt: "Laticínios",
  parentId: null,
  order: 0,
  ...over,
});

describe("categoryLabel", () => {
  it("pt-BR locale → namePt", () => {
    expect(categoryLabel(cat(), "pt-BR")).toBe("Laticínios");
  });

  it("es locale → nameEs", () => {
    expect(categoryLabel(cat(), "es")).toBe("Lácteos");
  });

  it("pt-BR locale com namePt vazio → fallback nameEs", () => {
    expect(categoryLabel(cat({ namePt: "" }), "pt-BR")).toBe("Lácteos");
  });

  it("pt-BR locale com namePt só espaços → fallback nameEs", () => {
    expect(categoryLabel(cat({ namePt: "   " }), "pt-BR")).toBe("Lácteos");
  });
});
