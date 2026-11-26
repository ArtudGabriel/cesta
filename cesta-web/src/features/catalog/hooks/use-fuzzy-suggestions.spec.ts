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

describe("useFuzzySuggestions (Sprint 179)", () => {
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

  it("query < 2 chars não aplica Fuse (passa data direto)", () => {
    const data = [makeSugg({ id: "a", name: "Leche" })];
    suggestMock.mockReturnValue({
      data,
      isPending: false,
      isFetching: false,
    });
    const { result } = renderHookWithProviders(() =>
      useFuzzySuggestions("a", 8),
    );
    expect(result.current.data).toEqual(data);
  });

  it("Fuse re-ranks por score ASC (best match primeiro)", () => {
    // Backend retornou 3 matches; query 'leche' deve privilegiar nome=leche
    const data = [
      makeSugg({ id: "pan", name: "Pan integral", brand: "Marca" }),
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
    const ids = result.current.data?.map((d) => d.id) ?? [];
    // Leche entera primeiro (match direto); "Pan integral" cortado pelo
    // threshold Fuse (zero relação com "leche"). "Yogur de leche" pode
    // ou não entrar — threshold 0.4 é apertado.
    expect(ids[0]).toBe("leche-a");
    expect(ids).not.toContain("pan");
  });

  it("typo severo além do threshold → fallback mantém data backend original", () => {
    const data = [makeSugg({ id: "leche", name: "Leche entera" })];
    suggestMock.mockReturnValue({
      data,
      isPending: false,
      isFetching: false,
    });
    const { result } = renderHookWithProviders(() =>
      useFuzzySuggestions("xyz987", 8),
    );
    // Fuse descarta tudo (score > 0.4), hook retorna data original (não vazio)
    expect(result.current.data).toEqual(data);
  });

  it("typo leve dentro do threshold: 'lecge' ainda encontra 'Leche entera'", () => {
    const data = [
      makeSugg({ id: "leche", name: "Leche entera 1L" }),
      makeSugg({ id: "pan", name: "Pan" }),
    ];
    suggestMock.mockReturnValue({
      data,
      isPending: false,
      isFetching: false,
    });
    const { result } = renderHookWithProviders(() =>
      useFuzzySuggestions("lecge", 8),
    );
    const ids = result.current.data?.map((d) => d.id) ?? [];
    expect(ids).toContain("leche");
  });
});
