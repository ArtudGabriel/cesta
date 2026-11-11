import { api } from "@/lib/api";
import type {
  ExpenseBucket,
  ExpenseSummary,
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
  ): Promise<{ jobId: string; receiptId: string; status: string }> {
    const form = new FormData();
    form.append("image", file);
    if (notes) form.append("notes", notes);
    const { data } = await api.post<
      Envelope<{ jobId: string; receiptId: string; status: string }>
    >("/receipts", form, {
      headers: { "Content-Type": "multipart/form-data" },
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
};
