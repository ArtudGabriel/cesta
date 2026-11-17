"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/stores/auth.store";
import { translateError } from "@/lib/translate-error";
import { ApiError } from "@/lib/api";
import { dsrService } from "../services/dsr.service";

/**
 * Sprint 91: GDPR Art. 20 — baixa ZIP multi-CSV via Blob + anchor click.
 * Filename vem de Content-Disposition. 429 (rate limit 1/hora) toast
 * dedicado.
 */
export function useExportMyData() {
  const t = useTranslations("profile.export");
  const tErr = useTranslations("errors");

  return useMutation({
    mutationFn: dsrService.exportMyData,
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      toast.success(t("success"));
    },
    onError: (err: Error) => {
      if (err instanceof ApiError && err.statusCode === 429) {
        toast.error(t("errorRateLimit"));
        return;
      }
      toast.error(translateError(err, tErr));
    },
  });
}

/**
 * Sprint 63: GDPR Art. 17 — soft-delete + revoke tokens + limpa estado
 * local (auth store + redirect pra /).
 */
export function useDeleteMyAccount() {
  const router = useRouter();
  const clearSession = useAuthStore((s) => s.clear);
  const t = useTranslations("profile.dsr");
  const tErr = useTranslations("errors");

  return useMutation({
    mutationFn: (confirmation: "ELIMINAR") =>
      dsrService.deleteMyAccount(confirmation),
    onSuccess: () => {
      clearSession();
      toast.success(t("deleteSuccess"));
      router.replace("/");
    },
    onError: (err: Error) => toast.error(translateError(err, tErr)),
  });
}
