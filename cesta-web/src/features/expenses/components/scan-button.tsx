"use client";

import { Camera, Loader2, RefreshCw, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useUploadReceipt } from "../hooks/use-expenses";

const MAX_IMAGE_MB = 10;
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
];

export function ScanButton() {
  const upload = useUploadReceipt();
  const t = useTranslations("expenses.ocr");
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // Sprint 176 — preview step entre pick file e submit. User vê thumbnail
  // + decide Enviar/Cancelar. Antes mutate disparava imediato onChange
  // (zero chance de desfazer foto borrada).
  const [pending, setPending] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);

  // Revoke object URL ao desmontar OR trocar arquivo.
  useEffect(() => {
    return () => {
      if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl);
    };
  }, [pending?.previewUrl]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error(t("invalidFormat"));
      return;
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      toast.error(t("maxSize", { mb: MAX_IMAGE_MB }));
      return;
    }

    // Revoke anterior antes de setar novo
    if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl);
    setPending({ file, previewUrl: URL.createObjectURL(file) });
  }

  function submit() {
    if (!pending) return;
    upload.mutate({ file: pending.file });
  }

  function cancel() {
    if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl);
    setPending(null);
    upload.reset();
  }

  const busy = upload.isPending;
  const uploadCompleteButRouting =
    !busy && upload.isSuccess && pending !== null;
  const errored = !busy && upload.isError;

  return (
    <div className="space-y-2">
      {pending && (
        <div
          className="flex items-center gap-3 rounded-card bg-white p-3 shadow-card"
          data-testid="scan-button-preview"
          data-sentry-mask
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pending.previewUrl}
            alt=""
            className="h-16 w-16 flex-shrink-0 rounded-btn object-cover"
          />
          <div className="min-w-0 flex-1 text-xs text-muted">
            {/* Sprint 176 AJUSTE Reviewer: wrapper preview tem data-sentry-mask
                (ticket image + file.name/size = PII per CLAUDE.md §GDPR Sprint 59).
                data-sentry-unmask é granular apenas nos state indicators abaixo
                (text i18n fixo + progress %) — file.name + file.size HERDAM mask
                do wrapper, nunca vazam Sentry Replay. */}
            <p className="truncate font-medium text-ink">{pending.file.name}</p>
            <p>{(pending.file.size / 1024).toFixed(0)} KB</p>
            {busy && upload.progress < 100 && (
              <p className="mt-0.5 text-cesta-green" data-sentry-unmask>
                {t("uploading")} {upload.progress}%
              </p>
            )}
            {busy && upload.progress >= 100 && (
              <p
                className="mt-0.5 text-cesta-green"
                data-sentry-unmask
                data-testid="scan-button-ocr-processing"
              >
                {t("parsing")}
              </p>
            )}
            {uploadCompleteButRouting && (
              <p className="mt-0.5 text-cesta-green" data-sentry-unmask>
                {t("parsing")}
              </p>
            )}
            {errored && (
              <p
                className="mt-0.5 text-coral"
                data-sentry-unmask
                data-testid="scan-button-error-text"
              >
                {upload.error?.message ?? t("parseFailed")}
              </p>
            )}
          </div>
          {!busy && !errored && (
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={cancel}
                aria-label={t("cancelCta")}
                data-testid="scan-button-cancel"
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={submit}
                data-testid="scan-button-submit"
              >
                {t("sendCta")}
              </Button>
            </div>
          )}
          {errored && (
            <Button
              size="sm"
              onClick={submit}
              aria-label={t("retryCta")}
              data-testid="scan-button-retry"
            >
              <RefreshCw className="h-4 w-4" />
              {t("retryCta")}
            </Button>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <input
          ref={cameraRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          capture="environment"
          onChange={handleFile}
          className="hidden"
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          onChange={handleFile}
          className="hidden"
        />
        <Button
          className="flex-1 min-h-[44px]"
          onClick={() => cameraRef.current?.click()}
          disabled={busy}
          aria-label={t("scanCta")}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          {t("scanCta")}
        </Button>
        <Button
          variant="secondary"
          onClick={() => galleryRef.current?.click()}
          disabled={busy}
          aria-label={t("uploadCta")}
          className="min-h-[44px] min-w-[44px]"
        >
          <Upload className="h-4 w-4" />
        </Button>
      </div>

      {busy && (
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-surface"
          role="progressbar"
          aria-valuenow={upload.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("uploading")}
        >
          <div
            className="h-full bg-cesta-green transition-all duration-150"
            style={{ width: `${upload.progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
