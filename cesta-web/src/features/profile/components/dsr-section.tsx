"use client";

import { AlertTriangle, Download, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDeleteMyAccount, useExportMyData } from "../hooks/use-dsr";

/**
 * Sprint 63 GDPR Art. 17 + 20 — seção "Mis datos" em /perfil.
 * - `data-sentry-mask` no wrapper (regra Sprint 59 — PII-adjacent).
 * - Touch 44x44 em todos os botões per identidade-visual.md.
 */
export function DsrSection() {
  const t = useTranslations("profile.dsr");
  const exportMutation = useExportMyData();
  const deleteMutation = useDeleteMyAccount();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <section data-sentry-mask className="px-4 pt-4">
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
        {t("title")}
      </h2>
      <div className="rounded-card bg-white p-4 shadow-sm space-y-3">
        <p className="text-sm text-muted">{t("subtitle")}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 flex-1"
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
          >
            <Download className="h-4 w-4" aria-hidden />
            {t("exportButton")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="min-h-11 flex-1"
            onClick={() => setModalOpen(true)}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            {t("deleteButton")}
          </Button>
        </div>
      </div>

      {modalOpen && (
        <DeleteAccountModal
          onCancel={() => setModalOpen(false)}
          onConfirm={() => {
            deleteMutation.mutate("ELIMINAR");
          }}
          isPending={deleteMutation.isPending}
        />
      )}
    </section>
  );
}

interface DeleteAccountModalProps {
  onCancel: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

function DeleteAccountModal({
  onCancel,
  onConfirm,
  isPending,
}: DeleteAccountModalProps) {
  const t = useTranslations("profile.dsr");
  const [confirmText, setConfirmText] = useState("");
  const confirmWord = t("deleteConfirmWord");
  const canConfirm = confirmText.trim() === confirmWord;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
      data-sentry-mask
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 px-4"
    >
      <div className="w-full max-w-md rounded-card bg-white p-5 shadow-card-elevated">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-coral/15 text-coral">
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p
              id="delete-account-title"
              className="font-display text-base font-bold text-ink"
            >
              {t("deleteConfirmTitle")}
            </p>
            <p className="mt-1 text-sm text-muted">{t("deleteConfirmBody")}</p>
          </div>
        </div>
        <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-muted">
          {t("deleteConfirmPrompt")}
        </label>
        <Input
          autoFocus
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={confirmWord}
          className="mt-1"
          disabled={isPending}
        />
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            onClick={onCancel}
            disabled={isPending}
          >
            {t("deleteCancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="min-h-11"
            onClick={onConfirm}
            disabled={!canConfirm || isPending}
          >
            {t("deleteConfirmButton")}
          </Button>
        </div>
      </div>
    </div>
  );
}
