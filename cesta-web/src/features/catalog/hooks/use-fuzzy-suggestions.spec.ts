import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHookWithProviders } from "@/test-utils";
import { useFuzzySuggestions } from "./use-fuzzy-suggestions";

const suggestMock = vi.fn();
vi.mock("./use-suggestions", () => ({
  useSuggestions: (q: string, limit: number) => suggestMock(q, limit),
}));

function makeSugg(overrides: Partial<{ id: string; name: string; brand: string | null }>) {
  return {
    id: overrides.id ?? "p-1",
    name: overrides.name ?? "Leche entera 1L",
    brand: overrides.brand ?? null,
    imageUrl: null,
    cheapestPrice: null,
  };
}

// Sprint 237 — hook virou pass-through pro useSuggestions depois que o
// Fuse.js re-rank foi removido. Backend `findSuggestions` agora aplica
// tiers determinísticos (match-score.util.ts). Testes aqui garantem
// (a) delegação transparente ao useSuggestions e (b) que a ordem do
// backend é preservada sem reordenação client-side.
describe("useFuzzySuggestions (Sprint 237 pass-through)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delega dataset undefined quando backend ainda não retornou", () => {
    suggestMock.mockReturnValue({
      data: undefined,
      isPending: true,
      isFetching: true,
    });
    const { result } = renderHookWithProviders(() =>
      useFuzzySuggestions("leche", 8),
    );
    expect(result.current.data).toBeUndefined();
    expect(result.current.isPending).toBe(true);
  });

  it("preserva ordem do backend sem reordenar (ex: tier do /suggest)", () => {
    const data = [
      makeSugg({ id: "leche-a", name: "Leche entera 1L", brand: null }),
      makeSugg({ id: "yogur", name: "Yogur de leche", brand: null }),
    ];
    suggestMock.mockReturnValue({
      data,
      isPending: false,
      isFetching: false,
    });
    const { result } = renderHookWithProviders(() =>
      useFuzzySuggestions("leche", 8),
    );
    expect(result.current.data?.map((d) => d.id)).toEqual([
      "leche-a",
      "yogur",
    ]);
  });

  it("repassa limit pro useSuggestions", () => {
    suggestMock.mockReturnValue({
      data: [],
      isPending: false,
      isFetching: false,
    });
    renderHookWithProviders(() => useFuzzySuggestions("leche", 5));
    expect(suggestMock).toHaveBeenCalledWith("leche", 5);
  });

  it("query vazia continua delegando (filtro `enabled` fica a cargo do useSuggestions)", () => {
    suggestMock.mockReturnValue({
      data: undefined,
      isPending: false,
      isFetching: false,
    });
    const { result } = renderHookWithProviders(() =>
      useFuzzySuggestions("", 8),
    );
    expect(result.current.data).toBeUndefined();
    expect(suggestMock).toHaveBeenCalledWith("", 8);
  });
});
