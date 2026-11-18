import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import React from "react";
import messages from "@/i18n/messages/es.json";
import { expensesService } from "../services/expenses.service";
import type { Receipt } from "../types/expense.types";
import {
  EXPENSES_KEYS,
  useRemoveReceiptItem,
  useUpdateReceiptItem,
} from "./use-expenses";

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
    updateReceipt: vi.fn(),
    updateReceiptItem: vi.fn(),
    addReceiptItem: vi.fn(),
    removeReceiptItem: vi.fn(),
    summary: vi.fn(),
    byCategory: vi.fn(),
    bySupermarket: vi.fn(),
  },
}));

const mocked = expensesService as unknown as {
  updateReceiptItem: ReturnType<typeof vi.fn>;
  removeReceiptItem: ReturnType<typeof vi.fn>;
};

function renderWithShared<T>(hook: () => T) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(
        NextIntlClientProvider,
        { locale: "es", messages, children },
      ),
    );
  const utils = renderHook(hook, { wrapper });
  return { ...utils, queryClient };
}

const baseReceipt: Receipt = {
  id: "r1",
  status: "ready",
  errorMessage: null,
  supermarketSlug: null,
  supermarketName: null,
  purchaseDate: null,
  total: 10,
  imageUrl: null,
  notes: null,
  createdAt: "2026-11-18T00:00:00Z",
  items: [
    {
      id: "i1",
      rawText: "LEITE",
      normalizedName: "leite",
      quantity: 1,
      unitPrice: 10,
      total: 10,
      productId: null,
      productName: null,
      position: 0,
    },
  ],
};

describe("useUpdateReceiptItem — optimistic + rollback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("optimistically recomputes item total on qty+unitPrice change", async () => {
    let resolveApi: (value: Receipt) => void = () => {};
    mocked.updateReceiptItem.mockImplementation(
      () =>
        new Promise<Receipt>((resolve) => {
          resolveApi = resolve;
        }),
    );
    const { result, queryClient } = renderWithShared(() =>
      useUpdateReceiptItem("r1"),
    );
    queryClient.setQueryData(EXPENSES_KEYS.receipt("r1"), baseReceipt);

    act(() => {
      result.current.mutate({
        itemId: "i1",
        payload: { quantity: 2, unitPrice: 5 },
      });
    });

    await waitFor(() => {
      const snapshot = queryClient.getQueryData<Receipt>(
        EXPENSES_KEYS.receipt("r1"),
      );
      expect(snapshot?.items[0].quantity).toBe(2);
    });

    const snapshot = queryClient.getQueryData<Receipt>(
      EXPENSES_KEYS.receipt("r1"),
    );
    expect(snapshot?.items[0].total).toBe(10);
    expect(snapshot?.items[0].unitPrice).toBe(5);
    resolveApi(baseReceipt);
  });

  it("rolls back on server error", async () => {
    mocked.updateReceiptItem.mockRejectedValueOnce(new Error("boom"));
    const { result, queryClient } = renderWithShared(() =>
      useUpdateReceiptItem("r1"),
    );
    queryClient.setQueryData(EXPENSES_KEYS.receipt("r1"), baseReceipt);

    await act(async () => {
      await result.current
        .mutateAsync({ itemId: "i1", payload: { quantity: 99 } })
        .catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const snapshot = queryClient.getQueryData<Receipt>(
      EXPENSES_KEYS.receipt("r1"),
    );
    expect(snapshot?.items[0].quantity).toBe(1);
  });
});

describe("useRemoveReceiptItem — optimistic remove", () => {
  beforeEach(() => vi.clearAllMocks());

  it("removes item from cache immediately", async () => {
    mocked.removeReceiptItem.mockResolvedValue(undefined);
    const { result, queryClient } = renderWithShared(() =>
      useRemoveReceiptItem("r1"),
    );
    queryClient.setQueryData(EXPENSES_KEYS.receipt("r1"), baseReceipt);

    await act(async () => {
      result.current.mutate("i1");
    });

    const snapshot = queryClient.getQueryData<Receipt>(
      EXPENSES_KEYS.receipt("r1"),
    );
    expect(snapshot?.items).toHaveLength(0);
  });
});
