"use client";

import { Bell, Plus } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function AlertsEmptyState() {
  const t = useTranslations("alerts.emptyState");
  return (
    <div
      className="flex flex-col items-center gap-4 rounded-card bg-white px-6 py-10 text-center shadow-card"
      data-testid="alerts-empty-state"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface">
        <Bell className="h-7 w-7 text-cesta-green" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h3 className="font-display text-base font-bold text-ink">
          {t("title")}
        </h3>
        <p className="max-w-xs text-sm text-muted">{t("body")}</p>
      </div>
      <Button asChild size="sm" variant="primary">
        <Link href="/alertas/novo" data-testid="alerts-empty-cta">
          <Plus className="h-4 w-4" />
          {t("cta")}
        </Link>
      </Button>
    </div>
  );
}
