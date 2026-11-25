import { api } from "@/lib/api";
import type {
  ExpenseBucket,
  ExpenseSummary,
  ExpenseTopProduct,
  Period,
  Receipt,
} from "../types/expense.types";

interface Envelope<T> {
  data: T;
}

export const expensesService = {
  async uploadReceipt(
    file: File,
    notes?: string,
    onProgress?: (pct: number) => void,
  ): Promise<{ jobId: string; receiptId: string; status: string }> {
    const form = new FormData();
    form.append("image", file);
    if (notes) form.append("notes", notes);
    const { data } = await api.post<
      Envelope<{ jobId: string; receiptId: string; status: string }>
    >("/receipts", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (!onProgress || !event.total) return;
        onProgress(Math.round((event.loaded / event.total) * 100));
      },
    });
    return data.data;
  },

  async listReceipts(): Promise<Receipt[]> {
    const { data } = await api.get<Envelope<Receipt[]>>("/receipts");
    return data.data;
  },

  async getReceipt(id: string): Promise<Receipt> {
    const { data } = await api.get<Envelope<Receipt>>(`/receipts/${id}`);
    return data.data;
  },

  async removeReceipt(id: string): Promise<void> {
    await api.delete(`/receipts/${id}`);
  },

  async updateReceipt(
    id: string,
    payload: {
      supermarketSlug?: string | null;
      purchaseDate?: string | null;
      total?: number | null;
      notes?: string;
    },
  ): Promise<Receipt> {
    const { data } = await api.patch<Envelope<Receipt>>(
      `/receipts/${id}`,
      payload,
    );
    return data.data;
  },

  async updateReceiptItem(
    receiptId: string,
    itemId: string,
    payload: {
      quantity?: number;
      unitPrice?: number;
      productId?: string | null;
    },
  ): Promise<Receipt> {
    const { data } = await api.patch<Envelope<Receipt>>(
      `/receipts/${receiptId}/items/${itemId}`,
      payload,
    );
    return data.data;
  },

  async addReceiptItem(
    receiptId: string,
    payload: {
      rawText: string;
      normalizedName: string;
      quantity: number;
      unitPrice: number;
      productId?: string | null;
      categoryHint?: string | null;
    },
  ): Promise<Receipt> {
    const { data } = await api.post<Envelope<Receipt>>(
      `/receipts/${receiptId}/items`,
      payload,
    );
    return data.data;
  },

  async removeReceiptItem(receiptId: string, itemId: string): Promise<void> {
    await api.delete(`/receipts/${receiptId}/items/${itemId}`);
  },

  async summary(period: Period): Promise<ExpenseSummary> {
    const { data } = await api.get<Envelope<ExpenseSummary>>(
      "/expenses/summary",
      { params: { period } },
    );
    return data.data;
  },

  async byCategory(period: Period): Promise<ExpenseBucket[]> {
    const { data } = await api.get<Envelope<ExpenseBucket[]>>(
      "/expenses/by-category",
      { params: { period } },
    );
    return data.data;
  },

  async bySupermarket(period: Period): Promise<ExpenseBucket[]> {
    const { data } = await api.get<Envelope<ExpenseBucket[]>>(
      "/expenses/by-supermarket",
      { params: { period } },
    );
    return data.data;
  },

  // Sprint 162
  async topProducts(period: Period): Promise<ExpenseTopProduct[]> {
    const { data } = await api.get<Envelope<ExpenseTopProduct[]>>(
      "/expenses/top-products",
      { params: { period } },
    );
    return data.data;
  },
};
