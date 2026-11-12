"use client";

import { ArrowLeft, Loader2, Receipt } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ExpenseDashboard } from "@/features/expenses/components/expense-summary";
import { ScanButton } from "@/features/expenses/components/scan-button";
import { useReceipts } from "@/features/expenses/hooks/use-expenses";
import { formatPrice } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";

export default function GastosPage() {
  const user = useAuthStore((s) => s.user);
  const receipts = useReceipts();
  const t = useTranslations("expenses");
  const tNav = useTranslations("nav");

  if (!user) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
        <p className="text-sm text-muted">{t("loginRequired")}</p>
        <Button asChild size="sm">
          <Link href="/login">{t("loginCta")}</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-cream px-4 py-3">
        <Button asChild size="icon" variant="ghost" aria-label={tNav("back")}>
          <Link href="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="font-display text-lg font-bold text-ink">{t("title")}</h1>
      </header>

      <div className="px-4 py-4 space-y-6">
        <ScanButton />

        <ExpenseDashboard />

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            {t("recentReceipts")}
          </h2>
          {receipts.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-cesta-green" />
            </div>
          ) : !receipts.data || receipts.data.length === 0 ? (
            <div className="rounded-card border border-dashed border-border bg-white/50 p-6 text-center text-sm text-muted">
              {t("empty")}
            </div>
          ) : (
            <ul className="space-y-2">
              {receipts.data.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/gastos/${r.id}`}
                    className="flex items-center gap-3 rounded-card bg-white p-3 shadow-card"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-btn bg-surface">
                      <Receipt className="h-5 w-5 text-muted" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">
                        {r.supermarketName ?? t("unknownMarket")}
                      </p>
                      <p className="text-xs text-muted">
                        {r.purchaseDate
                          ? new Date(r.purchaseDate).toLocaleDateString("es-ES")
                          : new Date(r.createdAt).toLocaleDateString("es-ES")}
                        {r.status !== "ready" && (
                          <span className="ml-2 text-amber">
                            · {r.status === "failed" ? t("failed") : t("processing")}
                          </span>
                        )}
                      </p>
                    </div>
                    {r.total !== null && (
                      <span className="text-sm font-bold text-cesta-green">
                        {formatPrice(r.total)}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
