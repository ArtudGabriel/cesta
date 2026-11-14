"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/stores/auth.store";
import { translateError } from "@/lib/translate-error";
import { dsrService } from "../services/dsr.service";

/**
 * Sprint 63: GDPR Art. 20 — baixa JSON direto do browser via Blob + anchor
 * click. Toast success/error traduzido (Sprint 38 pattern).
 */
export function useExportMyData() {
  const t = useTranslations("profile.dsr");
  const tErr = useTranslations("errors");

  return useMutation({
    mutationFn: dsrService.exportMyData,
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      anchor.download = `cesta-datos-${timestamp}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      toast.success(t("exportSuccess"));
    },
    onError: (err: Error) => toast.error(translateError(err, tErr)),
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
