"use client";

import { Bell, BellOff, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  useDeleteAlertRule,
  useToggleAlertRule,
} from "@/features/alerts/hooks/use-alerts";
import type { AlertRule } from "@/features/alerts/types/alert.types";
import { cn, formatPrice } from "@/lib/utils";

interface AlertRuleCardProps {
  rule: AlertRule;
}

export function AlertRuleCard({ rule }: AlertRuleCardProps) {
  const t = useTranslations("alerts.rules");
  const tActions = useTranslations("alerts");
  const toggle = useToggleAlertRule();
  const remove = useDeleteAlertRule();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
      data-testid={`alert-rule-card-${rule.id}`}
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

        <div className="flex flex-col gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label={
              rule.isActive
                ? tActions("actionDeactivate")
                : tActions("actionActivate")
            }
            onClick={() =>
              toggle.mutate({ id: rule.id, isActive: !rule.isActive })
            }
            disabled={toggle.isPending}
            data-testid={`alert-rule-toggle-${rule.id}`}
          >
            {rule.isActive ? (
              <Bell className="h-4 w-4 text-cesta-green" />
            ) : (
              <BellOff className="h-4 w-4 text-muted" />
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={tActions("actionDelete")}
            onClick={() => setShowDeleteConfirm(true)}
            disabled={remove.isPending}
            data-testid={`alert-rule-delete-${rule.id}`}
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
          remove.mutate(rule.id);
        }}
        title={tActions("confirmDelete")}
        destructive
        isPending={remove.isPending}
      />
    </div>
  );
}
