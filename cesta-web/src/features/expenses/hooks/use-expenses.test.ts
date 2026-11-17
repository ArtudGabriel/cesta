import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, waitFor } from "@testing-library/react";
import { renderHookWithProviders } from "@/test-utils";
import { expensesService } from "../services/expenses.service";
import { useUploadReceipt } from "./use-expenses";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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
});
