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
    // Sprint 228 #15b (AJUSTE P1 QA empírico 2026-11-27): instance default
    // `Content-Type: application/json` (lib/api.ts:12) força axios default
    // transformRequest a converter FormData em JSON via `formDataToJSON`
    // quando `headers.getContentType()` contém 'application/json'
    // (node_modules/axios/lib/defaults/index.js:57). Body chegava ao
    // backend como `{"image": "[object File]"}` plano texto, multer não
    // achava campo multipart -> 400 "Imagem é obrigatória". Fix anterior
    // S228 #15 removeu Content-Type explícito mas instance default
    // persistia; QA retest ainda via 400.
    //
    // Correção definitiva: override Content-Type pra 'multipart/form-data'
    // per-request. Axios transformRequest vê content-type sem 'json' ->
    // preserva FormData intacta. Depois resolveConfig (helpers/resolveConfig.js:86)
    // vê FormData + hasStandardBrowserEnv -> chama setContentType(undefined)
    // removendo a declaração sem boundary -> browser nativamente seta
    // multipart/form-data; boundary=... no xhr.send(FormData).
    //
    // adapter XHR per-request preservado (justificativa #15 original:
    // fetch adapter + onUploadProgress + Render HTTP/1.1 aborta stream
    // request body antes do JWT guard).
    const { data } = await api.post<
      Envelope<{ jobId: string; receiptId: string; status: string }>
    >("/receipts", form, {
      adapter: "xhr",
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
