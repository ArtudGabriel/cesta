import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, waitFor } from "@testing-library/react";
import { renderHookWithProviders } from "@/test-utils";
import { ApiError } from "@/lib/api";
import { expensesService } from "../services/expenses.service";
import { useUploadReceipt } from "./use-expenses";

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
}));

const clearAuthMock = vi.fn();
vi.mock("@/stores/auth.store", () => ({
  useAuthStore: (selector: (s: { clear: () => void }) => unknown) =>
    selector({ clear: clearAuthMock }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../services/expenses.service", () => ({
  expensesService: {
    uploadReceipt: vi.fn(),
    listReceipts: vi.fn(),
    getReceipt: vi.fn(),
    removeReceipt: vi.fn(),
    summary: vi.fn(),
    byCategory: vi.fn(),
    bySupermarket: vi.fn(),
  },
}));

const mocked = expensesService as unknown as {
  uploadReceipt: ReturnType<typeof vi.fn>;
};

describe("useUploadReceipt", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reporta progresso de upload via callback", async () => {
    mocked.uploadReceipt.mockImplementation(async (_file, _notes, onProgress) => {
      onProgress?.(50);
      onProgress?.(100);
      return { jobId: "j1", receiptId: "r1", status: "queued" };
    });

    const { result } = renderHookWithProviders(() => useUploadReceipt());
    const file = new File(["x"], "ticket.jpg", { type: "image/jpeg" });

    await act(async () => {
      result.current.mutate({ file });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocked.uploadReceipt).toHaveBeenCalledWith(
      file,
      undefined,
      expect.any(Function),
    );
  });

  it("mostra mensagem de rate limit quando backend devolve 429", async () => {
    const { toast } = await import("sonner");
    mocked.uploadReceipt.mockRejectedValue(new Error("Too Many Requests"));

    const { result } = renderHookWithProviders(() => useUploadReceipt());
    const file = new File(["x"], "ticket.jpg", { type: "image/jpeg" });

    await act(async () => {
      result.current.mutate({ file });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/1 hora|hora/i),
    );
  });

  describe("Sprint 243 #2 session expired", () => {
    it("ApiError 401 → toast sessionExpired + redirect /login + clearAuth", async () => {
      const { toast } = await import("sonner");
      routerPush.mockReset();
      clearAuthMock.mockReset();
      mocked.uploadReceipt.mockRejectedValue(
        new ApiError("Unauthorized", "AUTH.UNAUTHORIZED", 401),
      );

      const { result } = renderHookWithProviders(() => useUploadReceipt());
      const file = new File(["x"], "ticket.jpg", { type: "image/jpeg" });

      await act(async () => {
        result.current.mutate({ file });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringMatching(/sesión expirada|sessão expirada|session/i),
      );
      // NUNCA "Unauthorized" / "Token ausente"
      expect(toast.error).not.toHaveBeenCalledWith("Unauthorized");
      expect(toast.error).not.toHaveBeenCalledWith(
        expect.stringMatching(/token ausente/i),
      );
      expect(routerPush).toHaveBeenCalledWith("/login?returnUrl=%2Fgastos");
      expect(clearAuthMock).toHaveBeenCalledTimes(1);
    });

    it("ApiError 500 NÃO redireciona nem chama clearAuth (só toast.error)", async () => {
      routerPush.mockReset();
      clearAuthMock.mockReset();
      mocked.uploadReceipt.mockRejectedValue(
        new ApiError("Internal", "INTERNAL", 500),
      );

      const { result } = renderHookWithProviders(() => useUploadReceipt());
      const file = new File(["x"], "ticket.jpg", { type: "image/jpeg" });

      await act(async () => {
        result.current.mutate({ file });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(routerPush).not.toHaveBeenCalled();
      expect(clearAuthMock).not.toHaveBeenCalled();
    });
  });
});
