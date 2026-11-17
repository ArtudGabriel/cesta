"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useReactivateAccount } from "../hooks/use-auth";
import type { ReactivatePayload, SoftDeletedMeta } from "../types/auth.types";

interface Props {
  meta: SoftDeletedMeta;
  payload: ReactivatePayload;
  onDismiss: () => void;
}

interface Countdown {
  days: number;
  hours: number;
  expired: boolean;
}

function computeCountdown(graceEndsAt: string): Countdown {
  const diffMs = new Date(graceEndsAt).getTime() - Date.now();
  if (Number.isNaN(diffMs) || diffMs <= 0) {
    return { days: 0, hours: 0, expired: true };
  }
  const totalHours = Math.floor(diffMs / (60 * 60 * 1000));
  return {
    days: Math.floor(totalHours / 24),
    hours: totalHours % 24,
    expired: false,
  };
}

export function AccountSoftDeletedBanner({ meta, payload, onDismiss }: Props) {
  const t = useTranslations("auth.reactivate");
  const reactivate = useReactivateAccount();
  const [open, setOpen] = useState(false);
  const [countdown, setCountdown] = useState<Countdown>(() =>
    computeCountdown(meta.graceEndsAt),
  );

  useEffect(() => {
    setCountdown(computeCountdown(meta.graceEndsAt));
    // Atualiza a cada 60s pra manter o contador coerente sem thrash de render.
    const id = window.setInterval(() => {
      setCountdown(computeCountdown(meta.graceEndsAt));
    }, 60_000);
    return () => window.clearInterval(id);
  }, [meta.graceEndsAt]);

  const handleConfirm = () => {
    reactivate.mutate(payload, {
      onSuccess: () => setOpen(false),
    });
  };

  return (
    <div
      role="status"
      aria-live="polite"
      data-sentry-unmask
      className="mb-4 rounded-card border border-amber/30 bg-amber/10 p-4"
    >
      <p className="font-display text-sm font-bold text-ink">
        {t("bannerTitle")}
      </p>
      <p className="mt-1 text-sm text-ink/80">
        {countdown.expired
          ? t("bannerExpired")
          : t("bannerCountdown", {
              days: countdown.days,
              hours: countdown.hours,
            })}
      </p>
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          variant="primary"
          className="flex-1"
          onClick={() => setOpen(true)}
          disabled={countdown.expired || reactivate.isPending}
        >
          {t("reactivateCta")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={onDismiss}
          disabled={reactivate.isPending}
        >
          {t("dismiss")}
        </Button>
      </div>

      <ConfirmDialog
        open={open}
        onClose={() => {
          if (!reactivate.isPending) setOpen(false);
        }}
        onConfirm={handleConfirm}
        title={t("modalTitle")}
        body={t("modalDescription")}
        confirmLabel={t("modalConfirm")}
        cancelLabel={t("modalCancel")}
        isPending={reactivate.isPending}
      />
    </div>
  );
}
