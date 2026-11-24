"use client";

import { ArrowLeft, Bell, BellOff, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AlertCard } from "@/features/alerts/components/alert-card";
import { AlertsEmptyState } from "@/features/alerts/components/alerts-empty-state";
import {
  useAlertRules,
  useAlerts,
} from "@/features/alerts/hooks/use-alerts";
import { usePush } from "@/features/alerts/hooks/use-push";
import type { AlertRule } from "@/features/alerts/types/alert.types";
import { cn, formatPrice } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";

export default function AlertsPage() {
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const router = useRouter();
  const alerts = useAlerts();
  const rules = useAlertRules();
  const push = usePush();
  const t = useTranslations("alerts");
  const tRules = useTranslations("alerts.rules");
  const tNav = useTranslations("nav");

  useEffect(() => {
    if (isHydrated && !user) {
      router.replace(`/login?returnUrl=${encodeURIComponent("/alertas")}`);
    }
  }, [isHydrated, user, router]);

  const { active, triggered } = useMemo(() => {
    const data = alerts.data ?? [];
    return {
      active: data.filter((a) => !a.lastTriggeredAt),
      triggered: data.filter((a) => a.lastTriggeredAt),
    };
  }, [alerts.data]);

  const totalAlerts = active.length + triggered.length;
  const showEmptyState =
    !alerts.isLoading && totalAlerts === 0 && (rules.data?.length ?? 0) === 0;

  if (!isHydrated || !user) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-cesta-green" />
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
        <div className="ml-auto">
          <Button asChild size="sm" variant="primary">
            <Link href="/alertas/novo" data-testid="alerts-new-rule-cta">
              <Plus className="h-4 w-4" />
              {tRules("newCta")}
            </Link>
          </Button>
        </div>
      </header>

      {push.supported && (
        <section className="px-4 py-4">
          <div className="rounded-card bg-white p-4 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-display text-sm font-bold text-ink">
                  {t("pushHeader")}
                </p>
                <p className="text-xs text-muted">
                  {push.subscribed ? t("pushActive") : t("pushInactive")}
                </p>
              </div>
              <Button
                size="sm"
                variant={push.subscribed ? "ghost" : "primary"}
                onClick={() =>
                  push.subscribed ? push.disable() : push.enable()
                }
                disabled={push.loading}
              >
                {push.loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : push.subscribed ? (
                  <BellOff className="h-4 w-4" />
                ) : (
                  <Bell className="h-4 w-4" />
                )}
                {push.subscribed ? t("pushDisable") : t("pushEnable")}
              </Button>
            </div>
          </div>
        </section>
      )}

      {alerts.isLoading ? (
        <section className="px-4">
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-cesta-green" />
          </div>
        </section>
      ) : showEmptyState ? (
        <section className="px-4 pt-2">
          <AlertsEmptyState />
        </section>
      ) : (
        <>
          {triggered.length > 0 && (
            <section
              className="px-4 pt-2"
              data-testid="alerts-triggered-section"
            >
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
                {t("triggeredHeader")}
              </h2>
              <ul className="space-y-2">
                {triggered.map((alert) => (
                  <li key={alert.id}>
                    <AlertCard alert={alert} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {active.length > 0 && (
            <section
              className="mt-6 px-4"
              data-testid="alerts-active-section"
            >
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
                {t("activeHeader")}
              </h2>
              <ul className="space-y-2">
                {active.map((alert) => (
                  <li key={alert.id}>
                    <AlertCard alert={alert} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <section className="mt-6 px-4" data-testid="alert-rules-section">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          {tRules("sectionHeader")}
        </h2>
        {rules.isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-cesta-green" />
          </div>
        ) : !rules.data || rules.data.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            {tRules("empty")}
          </p>
        ) : (
          <ul className="space-y-2">
            {rules.data.map((rule) => (
              <li key={rule.id}>
                <AlertRuleCard rule={rule} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function AlertRuleCard({ rule }: { rule: AlertRule }) {
  const t = useTranslations("alerts.rules");
  const label = t(`types.${rule.type}.label`);

  function summary() {
    if (rule.type === "trend") {
      const r = rule.rules as { consecutiveWeeks: number };
      return t("summary.trend", { weeks: String(r.consecutiveWeeks) });
    }
    if (rule.type === "combo") {
      const r = rule.rules as { productIds: string[]; targetTotal: number };
      return t("summary.combo", {
        count: String(r.productIds.length),
        total: formatPrice(r.targetTotal),
      });
    }
    const r = rule.rules as { productIds: string[]; targetSavings: number };
    return t("summary.bundle", {
      count: String(r.productIds.length),
      savings: formatPrice(r.targetSavings),
    });
  }

  return (
    <div
      className={cn(
        "rounded-card bg-white p-4 shadow-card",
        !rule.isActive && "opacity-60",
      )}
      data-sentry-mask
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold text-ink">{label}</p>
          <p className="mt-1 text-xs text-muted">{summary()}</p>
          {rule.lastTriggeredAt && (
            <p className="mt-2 text-[11px] text-muted">
              {t("lastTriggered")}{" "}
              {new Date(rule.lastTriggeredAt).toLocaleDateString("es-ES")}
            </p>
          )}
        </div>
        <Bell className="h-4 w-4 text-cesta-green" />
      </div>
    </div>
  );
}

