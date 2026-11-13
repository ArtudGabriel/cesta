"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { translateError } from "@/lib/translate-error";
import { syncDietaryService } from "../services/sync-dietary.service";

export function useSyncDietary() {
  const qc = useQueryClient();
  const t = useTranslations("profile.syncDietary");
  const tErr = useTranslations("errors");

  return useMutation({
    mutationFn: () => syncDietaryService.syncToFamily(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["family-profile"] });
      toast.success(t("success"));
    },
    onError: (err: Error) => {
      toast.error(translateError(err, tErr));
    },
  });
}
