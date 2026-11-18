"use client";

import { AlertCircle, CheckCircle2, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PROFILE_KEY } from "../hooks/use-profile";
import {
  useApplyImport,
  useCreateImport,
  useImportStatus,
} from "../hooks/use-import";
import type { ImportSummary } from "../services/import.service";

/**
 * Sprint 102 — GDPR Art. 20 simétrico ao export S91. Upload ZIP com 5 CSVs,
 * dry-run preview, apply idempotente. `data-sentry-mask` no wrapper: summary
 * tem só counts (sem PII) mas file picker + status podem vazar filename do
 * user.
 */
export function ImportSection() {
  const t = useTranslations("profile.import");
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const create = useCreateImport();
  const apply = useApplyImport();
  const { data: job } = useImportStatus(jobId);

  function pickFile() {
    inputRef.current?.click();
  }

  function onFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    create.mutate(
      { file, dryRun: true },
      {
        onSuccess: (res) => {
          setJobId(res.jobId);
        },
      },
    );
  }

  function onConfirmApply() {
    if (!jobId) return;
    apply.mutate(jobId, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: PROFILE_KEY });
      },
    });
  }

  function onCancel() {
    setJobId(null);
  }

  const status = job?.status ?? (create.isPending ? "pending" : null);

  return (
    <section data-sentry-mask className="px-4 pt-4">
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
        {t("title")}
      </h2>
      <div className="rounded-card bg-white p-4 shadow-sm space-y-3">
        <p className="text-sm text-muted">{t("description")}</p>
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          hidden
          aria-hidden
          onChange={onFileSelected}
        />
        <Button
          type="button"
          variant="secondary"
          className="min-h-11 w-full"
          onClick={pickFile}
          disabled={create.isPending || Boolean(jobId)}
        >
          <Upload className="h-4 w-4" aria-hidden />
          {create.isPending ? t("loading") : t("button")}
        </Button>

        {status && status !== "ready_to_apply" && status !== "complete" && status !== "failed" && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t(`status.${status}`)}
          </p>
        )}

        {job?.status === "ready_to_apply" && job.summary && (
          <ImportPreviewModal
            summary={job.summary}
            onCancel={onCancel}
            onConfirm={onConfirmApply}
            isPending={apply.isPending}
          />
        )}

        {job?.status === "complete" && job.summary && (
          <ImportSuccess summary={job.summary} onClose={onCancel} />
        )}

        {job?.status === "failed" && (
          <ImportFailure
            message={job.errorMessage ?? t("errorGeneric")}
            onClose={onCancel}
          />
        )}
      </div>
    </section>
  );
}

interface PreviewProps {
  summary: ImportSummary;
  onCancel: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

function ImportPreviewModal({
  summary,
  onCancel,
  onConfirm,
  isPending,
}: PreviewProps) {
  const t = useTranslations("profile.import");
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-preview-title"
      data-sentry-mask
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 px-4"
    >
      <div className="w-full max-w-md rounded-card bg-white p-5 shadow-card-elevated">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-mint/15 text-mint">
            <Upload className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p
              id="import-preview-title"
              className="font-display text-base font-bold text-ink"
            >
              {t("previewTitle")}
            </p>
            <p className="mt-1 text-sm text-muted">{t("previewBody")}</p>
          </div>
        </div>

        <ul className="mt-3 space-y-1 text-sm text-ink">
          <SummaryLine label={t("preview.favoritos")} added={summary.added.favoritos} skipped={summary.skipped.favoritos} />
          <SummaryLine
            label={t("preview.listas")}
            added={summary.added.listas}
            skipped={summary.skipped.listas}
            extra={summary.added.listaItems > 0 ? `+${summary.added.listaItems} ${t("preview.items")}` : undefined}
          />
          <SummaryLine label={t("preview.alertas")} added={summary.added.alertas} skipped={summary.skipped.alertas} />
          <SummaryLine label={t("preview.reviews")} added={summary.added.reviews} skipped={summary.skipped.reviews} />
          <SummaryLine
            label={t("preview.expenses")}
            added={summary.added.expenses}
            skipped={0}
            extra={summary.added.expenseItems > 0 ? `+${summary.added.expenseItems} ${t("preview.items")}` : undefined}
          />
          {summary.skipped.productsNotFound > 0 && (
            <li className="text-xs text-coral">
              {t("preview.productsNotFound", { count: summary.skipped.productsNotFound })}
            </li>
          )}
          {summary.errors.length > 0 && (
            <li className="text-xs text-coral">
              {t("preview.errors", { count: summary.errors.length })}
            </li>
          )}
        </ul>

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            onClick={onCancel}
            disabled={isPending}
          >
            {t("previewCancel")}
          </Button>
          <Button
            type="button"
            className="min-h-11"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {t("previewConfirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SummaryLine({
  label,
  added,
  skipped,
  extra,
}: {
  label: string;
  added: number;
  skipped: number;
  extra?: string;
}) {
  const t = useTranslations("profile.import");
  return (
    <li className="flex flex-wrap items-baseline gap-x-2">
      <span className="font-medium">{label}:</span>
      <span>{t("preview.added", { count: added })}</span>
      {skipped > 0 && (
        <span className="text-muted">
          · {t("preview.skipped", { count: skipped })}
        </span>
      )}
      {extra && <span className="text-muted">· {extra}</span>}
    </li>
  );
}

function ImportSuccess({
  summary,
  onClose,
}: {
  summary: ImportSummary;
  onClose: () => void;
}) {
  const t = useTranslations("profile.import");
  const totalAdded =
    summary.added.favoritos +
    summary.added.listas +
    summary.added.listaItems +
    summary.added.alertas +
    summary.added.reviews +
    summary.added.expenses +
    summary.added.expenseItems;
  return (
    <div className="flex items-start gap-2 rounded-card bg-mint/10 p-3 text-sm text-ink">
      <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-mint" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{t("successTitle", { count: totalAdded })}</p>
        <Button
          type="button"
          variant="ghost"
          className="mt-1 h-8 px-2 text-xs"
          onClick={onClose}
        >
          {t("close")}
        </Button>
      </div>
    </div>
  );
}

function ImportFailure({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  const t = useTranslations("profile.import");
  return (
    <div className="flex items-start gap-2 rounded-card bg-coral/10 p-3 text-sm text-ink">
      <AlertCircle className="h-5 w-5 flex-shrink-0 text-coral" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{t("errorTitle")}</p>
        <p className="mt-1 text-xs text-muted" data-sentry-mask>
          {message}
        </p>
        <Button
          type="button"
          variant="ghost"
          className="mt-1 h-8 px-2 text-xs"
          onClick={onClose}
        >
          {t("close")}
        </Button>
      </div>
    </div>
  );
}
