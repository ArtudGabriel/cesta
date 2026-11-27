"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { ApiError, setAccessToken } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { expensesService } from "../services/expenses.service";
import type { Period, Receipt } from "../types/expense.types";

export const EXPENSES_KEYS = {
  receipts: ["expenses", "receipts"] as const,
  receipt: (id: string) => ["expenses", "receipts", id] as const,
  summary: (period: Period) => ["expenses", "summary", period] as const,
  byCategory: (period: Period) =>
    ["expenses", "byCategory", period] as const,
  bySupermarket: (period: Period) =>
    ["expenses", "bySupermarket", period] as const,
  topProducts: (period: Period) =>
    ["expenses", "topProducts", period] as const,
};

export function useReceipts() {
  return useQuery({
    queryKey: EXPENSES_KEYS.receipts,
    queryFn: expensesService.listReceipts,
  });
}

export function useReceipt(id: string) {
  return useQuery({
    queryKey: EXPENSES_KEYS.receipt(id),
    queryFn: () => expensesService.getReceipt(id),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "processing" ? 3000 : false;
    },
  });
}

export function useUploadReceipt() {
  const qc = useQueryClient();
  const router = useRouter();
  const t = useTranslations("expenses.ocr");
  const tCommon = useTranslations("common");
  const clearAuth = useAuthStore((s) => s.clear);
  const [progress, setProgress] = useState(0);

  const mutation = useMutation({
    mutationFn: ({ file, notes }: { file: File; notes?: string }) => {
      setProgress(0);
      return expensesService.uploadReceipt(file, notes, setProgress);
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: EXPENSES_KEYS.receipts });
      toast.success(t("uploaded"));
      setProgress(0);
      router.push(`/gastos/${result.receiptId}`);
    },
    onError: (err: Error) => {
      setProgress(0);
      // Sprint 243 (#2 regressão parcial S228 #15): upload passa pelo
      // mesmo axios + refresh interceptor que os outros endpoints;
      // quando o refresh falha o interceptor rejeita com ApiError
      // status 401 (sessão realmente expirou). Antes esse erro
      // vinha com message cru do backend ("Unauthorized", "Token
      // ausente") e aparecia no toast. Agora: limpa auth local,
      // mostra toast i18n sessionExpired, redireciona pra /login
      // preservando o returnUrl de /gastos.
      if (err instanceof ApiError && err.statusCode === 401) {
        setAccessToken(null);
        clearAuth();
        toast.error(tCommon("sessionExpired"));
        router.push("/login?returnUrl=%2Fgastos");
        return;
      }
      const msg = err.message?.includes("Too Many Requests")
        ? t("rateLimited")
        : err.message;
      toast.error(msg);
    },
  });

  return { ...mutation, progress };
}

export function useRemoveReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => expensesService.removeReceipt(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EXPENSES_KEYS.receipts });
      toast.success("Nota eliminada");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateReceipt(id: string) {
  const qc = useQueryClient();
  const t = useTranslations("expenses.edit");
  return useMutation({
    mutationFn: (payload: {
      supermarketSlug?: string | null;
      purchaseDate?: string | null;
      total?: number | null;
      notes?: string;
    }) => expensesService.updateReceipt(id, payload),
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: EXPENSES_KEYS.receipt(id) });
      const prev = qc.getQueryData<Receipt>(EXPENSES_KEYS.receipt(id));
      if (prev) {
        qc.setQueryData<Receipt>(EXPENSES_KEYS.receipt(id), {
          ...prev,
          supermarketSlug:
            payload.supermarketSlug !== undefined
              ? payload.supermarketSlug
              : prev.supermarketSlug,
          purchaseDate:
            payload.purchaseDate !== undefined
              ? payload.purchaseDate
              : prev.purchaseDate,
          total: payload.total !== undefined ? payload.total : prev.total,
          notes: payload.notes !== undefined ? payload.notes : prev.notes,
        });
      }
      return { prev };
    },
    onError: (err: Error, _payload, ctx) => {
      if (ctx?.prev) qc.setQueryData(EXPENSES_KEYS.receipt(id), ctx.prev);
      toast.error(err.message || t("errorSave"));
    },
    onSuccess: (receipt) => {
      qc.setQueryData(EXPENSES_KEYS.receipt(id), receipt);
      qc.invalidateQueries({ queryKey: EXPENSES_KEYS.receipts });
      toast.success(t("saved"));
    },
  });
}

export function useUpdateReceiptItem(receiptId: string) {
  const qc = useQueryClient();
  const t = useTranslations("expenses.edit");
  return useMutation({
    mutationFn: ({
      itemId,
      payload,
    }: {
      itemId: string;
      payload: {
        quantity?: number;
        unitPrice?: number;
        productId?: string | null;
      };
    }) => expensesService.updateReceiptItem(receiptId, itemId, payload),
    onMutate: async ({ itemId, payload }) => {
      await qc.cancelQueries({ queryKey: EXPENSES_KEYS.receipt(receiptId) });
      const prev = qc.getQueryData<Receipt>(EXPENSES_KEYS.receipt(receiptId));
      if (prev) {
        qc.setQueryData<Receipt>(EXPENSES_KEYS.receipt(receiptId), {
          ...prev,
          items: prev.items.map((item) => {
            if (item.id !== itemId) return item;
            const nextQty = payload.quantity ?? item.quantity;
            const nextUnit = payload.unitPrice ?? item.unitPrice;
            return {
              ...item,
              quantity: nextQty,
              unitPrice: nextUnit,
              total: Math.round(nextQty * nextUnit * 100) / 100,
              productId:
                payload.productId !== undefined
                  ? payload.productId
                  : item.productId,
            };
          }),
        });
      }
      return { prev };
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.prev)
        qc.setQueryData(EXPENSES_KEYS.receipt(receiptId), ctx.prev);
      toast.error(err.message || t("errorSave"));
    },
    onSuccess: (receipt) => {
      qc.setQueryData(EXPENSES_KEYS.receipt(receiptId), receipt);
      qc.invalidateQueries({ queryKey: EXPENSES_KEYS.receipts });
    },
  });
}

export function useAddReceiptItem(receiptId: string) {
  const qc = useQueryClient();
  const t = useTranslations("expenses.edit");
  return useMutation({
    mutationFn: (payload: {
      rawText: string;
      normalizedName: string;
      quantity: number;
      unitPrice: number;
    }) => expensesService.addReceiptItem(receiptId, payload),
    onSuccess: (receipt) => {
      qc.setQueryData(EXPENSES_KEYS.receipt(receiptId), receipt);
      qc.invalidateQueries({ queryKey: EXPENSES_KEYS.receipts });
      toast.success(t("itemAdded"));
    },
    onError: (err: Error) => toast.error(err.message || t("errorSave")),
  });
}

export function useRemoveReceiptItem(receiptId: string) {
  const qc = useQueryClient();
  const t = useTranslations("expenses.edit");
  return useMutation({
    mutationFn: (itemId: string) =>
      expensesService.removeReceiptItem(receiptId, itemId),
    onMutate: async (itemId) => {
      await qc.cancelQueries({ queryKey: EXPENSES_KEYS.receipt(receiptId) });
      const prev = qc.getQueryData<Receipt>(EXPENSES_KEYS.receipt(receiptId));
      if (prev) {
        qc.setQueryData<Receipt>(EXPENSES_KEYS.receipt(receiptId), {
          ...prev,
          items: prev.items.filter((item) => item.id !== itemId),
        });
      }
      return { prev };
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.prev)
        qc.setQueryData(EXPENSES_KEYS.receipt(receiptId), ctx.prev);
      toast.error(err.message || t("errorSave"));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EXPENSES_KEYS.receipt(receiptId) });
      toast.success(t("itemRemoved"));
    },
  });
}

export function useExpenseSummary(period: Period) {
  return useQuery({
    queryKey: EXPENSES_KEYS.summary(period),
    queryFn: () => expensesService.summary(period),
  });
}

export function useExpensesByCategory(period: Period) {
  return useQuery({
    queryKey: EXPENSES_KEYS.byCategory(period),
    queryFn: () => expensesService.byCategory(period),
  });
}

export function useExpensesBySupermarket(period: Period) {
  return useQuery({
    queryKey: EXPENSES_KEYS.bySupermarket(period),
    queryFn: () => expensesService.bySupermarket(period),
  });
}

// Sprint 162
export function useExpensesTopProducts(period: Period) {
  return useQuery({
    queryKey: EXPENSES_KEYS.topProducts(period),
    queryFn: () => expensesService.topProducts(period),
  });
}
