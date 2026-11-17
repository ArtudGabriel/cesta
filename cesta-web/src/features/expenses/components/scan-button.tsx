"use client";

import { Camera, Loader2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useUploadReceipt } from "../hooks/use-expenses";

const MAX_IMAGE_MB = 5;
const ALLOWED_TYPES = ["image/jpeg", "image/png"];

export function ScanButton() {
  const upload = useUploadReceipt();
  const t = useTranslations("expenses.ocr");
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

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

    upload.mutate({ file });
  }

  const busy = upload.isPending;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          ref={cameraRef}
          type="file"
          accept="image/jpeg,image/png"
          capture="environment"
          onChange={handleFile}
          className="hidden"
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/jpeg,image/png"
          onChange={handleFile}
          className="hidden"
        />
        <Button
          className="flex-1"
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
