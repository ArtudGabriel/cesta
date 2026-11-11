"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { expensesService } from "../services/expenses.service";
import type { Period } from "../types/expense.types";

export const EXPENSES_KEYS = {
  receipts: ["expenses", "receipts"] as const,
  receipt: (id: string) => ["expenses", "receipts", id] as const,
  summary: (period: Period) => ["expenses", "summary", period] as const,
  byCategory: (period: Period) =>
    ["expenses", "byCategory", period] as const,
  bySupermarket: (period: Period) =>
    ["expenses", "bySupermarket", period] as const,
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
      return status === "pending" || status === "processing" ? 2000 : false;
    },
  });
}

export function useUploadReceipt() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: ({ file, notes }: { file: File; notes?: string }) =>
      expensesService.uploadReceipt(file, notes),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: EXPENSES_KEYS.receipts });
      toast.success("Nota enviada, procesando OCR…");
      router.push(`/gastos/${result.receiptId}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
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
