"use client";

import {
  ArrowLeft,
  Bell,
  BellOff,
  Loader2,
  Plus,
  Tag,
  Target,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  useAlertRules,
  useAlerts,
  useDeleteAlert,
  useToggleAlert,
} from "@/features/alerts/hooks/use-alerts";
import { usePush } from "@/features/alerts/hooks/use-push";
import type { Alert, AlertRule } from "@/features/alerts/types/alert.types";
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

      <section className="px-4 py-4">
        <div className="rounded-card bg-white p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-sm font-bold text-ink">
                {t("pushHeader")}
              </p>
              <p className="text-xs text-muted">
                {!push.supported
                  ? t("pushUnsupported")
                  : push.subscribed
                    ? t("pushActive")
                    : t("pushInactive")}
              </p>
            </div>
            {push.supported && (
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
            )}
          </div>
        </div>
      </section>

      <section className="px-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          {t("activeHeader")}
        </h2>
        {alerts.isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-cesta-green" />
          </div>
        ) : !alerts.data || alerts.data.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{t("empty")}</p>
        ) : (
          <ul className="space-y-2">
            {alerts.data.map((alert) => (
              <li key={alert.id}>
                <AlertCard alert={alert} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="px-4 mt-6" data-testid="alert-rules-section">
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

function AlertCard({ alert }: { alert: Alert }) {
  const toggle = useToggleAlert();
  const remove = useDeleteAlert();
  const t = useTranslations("alerts");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const label = describeType(alert, t);

  return (
    <div
      className={cn(
        "rounded-card bg-white p-4 shadow-card",
        !alert.isActive && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/produto/${alert.productId}`}
            className="line-clamp-1 text-sm font-medium text-ink hover:text-cesta-green"
          >
            {alert.productName}
          </Link>
          <p className="mt-1 text-xs text-muted">
            {alert.supermarketName ?? t("anyMarket")}
          </p>
          <p className="mt-2 inline-flex items-center gap-1 rounded-pill bg-surface px-2 py-0.5 text-[10px] font-medium text-ink">
            {label.icon}
            {label.text}
          </p>
          {alert.lastTriggeredAt && (
            <p className="mt-2 text-[11px] text-muted">
              {t("lastTriggered")}{" "}
              {new Date(alert.lastTriggeredAt).toLocaleDateString("es-ES")}
            </p>
          )}
        </div>

        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label={alert.isActive ? t("actionDeactivate") : t("actionActivate")}
            onClick={() =>
              toggle.mutate({ id: alert.id, isActive: !alert.isActive })
            }
          >
            {alert.isActive ? (
              <Bell className="h-4 w-4 text-cesta-green" />
            ) : (
              <BellOff className="h-4 w-4 text-muted" />
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={t("actionDelete")}
            onClick={() => setShowDeleteConfirm(true)}
            disabled={remove.isPending}
          >
            <Trash2 className="h-4 w-4 text-coral" />
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          setShowDeleteConfirm(false);
          remove.mutate(alert.id);
        }}
        title={t("confirmDelete")}
        destructive
        isPending={remove.isPending}
      />
    </div>
  );
}

type TFn = (key: string, values?: Record<string, string>) => string;

function describeType(alert: Alert, t: TFn): { icon: React.ReactNode; text: string } {
  switch (alert.type) {
    case "promotion":
      return { icon: <Tag className="h-3 w-3" />, text: t("types.promotion") };
    case "target_price":
      return {
        icon: <Target className="h-3 w-3" />,
        text: t("types.targetPrice", {
          price: alert.targetPrice ? formatPrice(alert.targetPrice) : t("types.unknownPrice"),
        }),
      };
    case "promotion_ending":
      return {
        icon: <Tag className="h-3 w-3" />,
        text: t("types.promotionEnding"),
      };
    case "back_in_stock":
      return { icon: <Bell className="h-3 w-3" />, text: t("types.backInStock") };
    default:
      return { icon: <Bell className="h-3 w-3" />, text: alert.type };
  }
}
