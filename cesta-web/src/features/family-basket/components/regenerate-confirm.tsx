"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface RegenerateConfirmProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function RegenerateConfirm({
  open,
  onConfirm,
  onCancel,
  loading,
}: RegenerateConfirmProps) {
  const t = useTranslations("familyBasket");
  if (!open) return null;

  return (
    <div
      onClick={onCancel}
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-card bg-cream p-5 shadow-card"
      >
        <h3 className="mb-2 font-display text-lg font-bold text-ink">
          {t("regenerateConfirmTitle")}
        </h3>
        <p className="mb-4 text-sm text-muted">
          {t("regenerateConfirmBody")}
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onCancel}
            disabled={loading}
          >
            {t("regenerateConfirmNo")}
          </Button>
          <Button
            className="flex-1"
            onClick={onConfirm}
            disabled={loading}
          >
            {t("regenerateConfirmYes")}
          </Button>
        </div>
      </div>
    </div>
  );
}
