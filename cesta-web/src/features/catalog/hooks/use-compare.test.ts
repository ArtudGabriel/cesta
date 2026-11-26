import { describe, expect, it, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";
import { renderHookWithProviders } from "@/test-utils";
import { useCompare } from "./use-compare";
import { compareService } from "../services/compare.service";

vi.mock("../services/compare.service", () => ({
  compareService: { fetch: vi.fn() },
}));

describe("useCompare (S215 regression)", () => {
  beforeEach(() => {
    vi.mocked(compareService.fetch).mockReset();
  });

  it("ids.length<2 → enabled:false → queryFn NÃO dispara (S215 root cause)", async () => {
    const { result } = renderHookWithProviders(() => useCompare(["single"]));
    // Esperar flush de microtasks — garante que, se queryFn fosse chamado,
    // já teria rodado.
    await new Promise((r) => setTimeout(r, 50));
    expect(compareService.fetch).not.toHaveBeenCalled();
    // v5: `isPending=true` quando enabled:false (status='pending', fetchStatus='idle').
    // Esse comportamento é o que motivou o reorder das branches em compare-client.tsx —
    // consumidor NÃO pode usar `isPending` como sinal exclusivo de loading.
    expect(result.current.isPending).toBe(true);
    expect(result.current.isFetching).toBe(false);
  });

  it("ids.length>=2 → enabled:true → queryFn dispara + resolve", async () => {
    vi.mocked(compareService.fetch).mockResolvedValue([]);
    const { result } = renderHookWithProviders(() => useCompare(["a", "b"]));
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(compareService.fetch).toHaveBeenCalledWith(["a", "b"]);
  });
});
