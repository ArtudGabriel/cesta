import { describe, expect, it } from "vitest";
import {
  stripGenerics,
  normalize,
  suggestSchemaFrom,
} from "./audit-response-usage.mjs";

/**
 * Sprint 212 G4 — audit-response-usage helpers (ADR 0022+0023+0024 chain).
 * Testa funções puras. Walk + I/O do main() são integração cobertos manualmente.
 */

describe("stripGenerics", () => {
  it("remove generics simples", () => {
    expect(stripGenerics("Promise<Product>")).toBe("Promise");
    expect(stripGenerics("Envelope<Alert[]>")).toBe("Envelope");
  });

  it("deixa tipo bare intacto", () => {
    expect(stripGenerics("ShoppingList")).toBe("ShoppingList");
    expect(stripGenerics("Alert[]")).toBe("Alert[]");
  });

  it("whitespace trim", () => {
    expect(stripGenerics("  Product  ")).toBe("Product");
  });
});

describe("normalize", () => {
  it("colapsa whitespace", () => {
    expect(normalize("  Alert   Trigger  ")).toBe("Alert Trigger");
    expect(normalize("Product\n  []")).toBe("Product []");
  });
});

describe("suggestSchemaFrom", () => {
  const baseline = new Set([
    "UserResponseDto",
    "ProductResponseDto",
    "ShoppingListResponseDto",
    "ListItemDto",
    "AlertResponseDto",
    "AlertTriggerDto",
    "FavoriteResponseDto",
  ]);

  it("tipo com sufixo ResponseDto direto", () => {
    expect(suggestSchemaFrom("Product", baseline)).toBe("ProductResponseDto");
    expect(suggestSchemaFrom("Alert", baseline)).toBe("AlertResponseDto");
  });

  it("AuthUser → UserResponseDto (prefixo Auth drop)", () => {
    expect(suggestSchemaFrom("AuthUser", baseline)).toBe("UserResponseDto");
  });

  it("ShoppingListItem → ListItemDto (override explícito)", () => {
    expect(suggestSchemaFrom("ShoppingListItem", baseline)).toBe("ListItemDto");
  });

  it("AlertTrigger → AlertTriggerDto (sufixo Dto)", () => {
    expect(suggestSchemaFrom("AlertTrigger", baseline)).toBe("AlertTriggerDto");
  });

  it("tipo sem match baseline retorna null", () => {
    expect(suggestSchemaFrom("InternalWidget", baseline)).toBe(null);
  });

  it("primitivo retorna null", () => {
    expect(suggestSchemaFrom("string", baseline)).toBe(null);
    expect(suggestSchemaFrom("void", baseline)).toBe(null);
  });

  it("array type strip", () => {
    expect(suggestSchemaFrom("Favorite[]", baseline)).toBe("FavoriteResponseDto");
  });
});
