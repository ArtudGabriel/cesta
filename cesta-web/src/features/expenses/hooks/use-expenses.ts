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
      return status === "pending" || status === "processing" ? 3000 : false;
    },
  });
}

export function useUploadReceipt() {
  const qc = useQueryClient();
  const router = useRouter();
  const t = useTranslations("expenses.ocr");
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
