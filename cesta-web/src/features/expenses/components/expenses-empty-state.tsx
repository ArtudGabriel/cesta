"use client";

import { Camera } from "lucide-react";
import { useTranslations } from "next-intl";
import { ScanButton } from "@/features/expenses/components/scan-button";

export function ExpensesEmptyState() {
  const t = useTranslations("expenses.emptyState");
  return (
    <div
      className="flex flex-col items-center gap-4 rounded-card bg-white px-6 py-10 text-center shadow-card"
      data-testid="expenses-empty-state"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface">
        <Camera className="h-7 w-7 text-cesta-green" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h3 className="font-display text-base font-bold text-ink">
          {t("title")}
        </h3>
        <p className="max-w-xs text-sm text-muted">{t("body")}</p>
      </div>
      <ScanButton />
    </div>
  );
}
