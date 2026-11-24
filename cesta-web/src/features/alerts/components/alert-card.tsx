"use client";

import { Bell, BellOff, Tag, Target, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  useDeleteAlert,
  useToggleAlert,
} from "@/features/alerts/hooks/use-alerts";
import type { Alert } from "@/features/alerts/types/alert.types";
import { cn, formatPrice } from "@/lib/utils";

type TFn = (key: string, values?: Record<string, string>) => string;

interface AlertCardProps {
  alert: Alert;
}

export function AlertCard({ alert }: AlertCardProps) {
  const toggle = useToggleAlert();
  const remove = useDeleteAlert();
  const t = useTranslations("alerts");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const label = describeType(alert, t);
  const isTriggered = Boolean(alert.lastTriggeredAt);

  return (
    <div
      className={cn(
        "rounded-card bg-white p-3 shadow-card",
        !alert.isActive && "opacity-60",
      )}
      data-testid={`alert-card-${alert.id}`}
    >
      <div className="flex items-start gap-3">
        <Link
          href={`/produto/${alert.productId}`}
          className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-btn bg-neutral-50"
          aria-hidden="true"
          tabIndex={-1}
        >
          {alert.productImageUrl ? (
            <Image
              src={alert.productImageUrl}
              alt=""
              fill
              sizes="56px"
              className="object-cover"
            />
          ) : (
            <div className="h-full w-full bg-neutral-100" />
          )}
          {isTriggered && alert.isActive && (
            <span
              className="absolute left-0 top-0 rounded-br-btn bg-cesta-green px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
              data-testid={`alert-badge-triggered-${alert.id}`}
            >
              {t("badgeTriggered")}
            </span>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <Link
            href={`/produto/${alert.productId}`}
            className="line-clamp-2 text-sm font-medium text-ink hover:text-cesta-green"
            data-sentry-mask
          >
            {alert.productName}
          </Link>
          <p className="mt-0.5 text-xs text-muted">
            {alert.supermarketName ?? t("anyMarket")}
          </p>
          <p className="mt-1.5 inline-flex items-center gap-1 rounded-pill bg-surface px-2 py-0.5 text-[10px] font-medium text-ink">
            {label.icon}
            {label.text}
          </p>
          {isTriggered && (
            <p className="mt-1 text-[11px] text-muted">
              {t("lastTriggered")}{" "}
              {new Date(alert.lastTriggeredAt as string).toLocaleDateString(
                "es-ES",
              )}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label={
              alert.isActive ? t("actionDeactivate") : t("actionActivate")
            }
            onClick={() =>
              toggle.mutate({ id: alert.id, isActive: !alert.isActive })
            }
            disabled={toggle.isPending}
            data-testid={`alert-toggle-${alert.id}`}
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
            data-testid={`alert-delete-${alert.id}`}
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

function describeType(
  alert: Alert,
  t: TFn,
): { icon: React.ReactNode; text: string } {
  switch (alert.type) {
    case "promotion":
      return { icon: <Tag className="h-3 w-3" />, text: t("types.promotion") };
    case "target_price":
      return {
        icon: <Target className="h-3 w-3" />,
        text: t("types.targetPrice", {
          price: alert.targetPrice
            ? formatPrice(alert.targetPrice)
            : t("types.unknownPrice"),
        }),
      };
    case "promotion_ending":
      return {
        icon: <Tag className="h-3 w-3" />,
        text: t("types.promotionEnding"),
      };
    case "back_in_stock":
      return {
        icon: <Bell className="h-3 w-3" />,
        text: t("types.backInStock"),
      };
    default:
      return { icon: <Bell className="h-3 w-3" />, text: alert.type };
  }
}
