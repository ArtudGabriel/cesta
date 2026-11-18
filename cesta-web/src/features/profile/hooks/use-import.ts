"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api";
import { translateError } from "@/lib/translate-error";
import {
  type ImportResult,
  type ImportStatus,
  importService,
} from "../services/import.service";

const ACTIVE_STATES: ImportStatus[] = ["pending", "parsing", "applying"];
const DONE_STATES: ImportStatus[] = [
  "ready_to_apply",
  "complete",
  "failed",
];

export function useCreateImport() {
  const t = useTranslations("profile.import");
  const tErr = useTranslations("errors");
  return useMutation({
    mutationFn: ({ file, dryRun }: { file: File; dryRun?: boolean }) =>
      importService.create(file, dryRun ?? true),
    onError: (err: Error) => {
      if (err instanceof ApiError && err.statusCode === 429) {
        toast.error(t("errorRateLimit"));
        return;
      }
      if (err instanceof ApiError && err.statusCode === 413) {
        toast.error(t("errorTooLarge"));
        return;
      }
      toast.error(translateError(err, tErr));
    },
  });
}

/**
 * Poll import status while active. Stops polling quando status vira terminal
 * (ready_to_apply, complete, failed). `jobId=null` desabilita o query.
 */
export function useImportStatus(jobId: string | null) {
  return useQuery<ImportResult>({
    queryKey: ["import", jobId],
    queryFn: () => importService.getStatus(jobId as string),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const state = query.state.data?.status;
      if (state && DONE_STATES.includes(state)) return false;
      return 1500;
    },
    staleTime: 0,
  });
}

export function useApplyImport() {
  const t = useTranslations("profile.import");
  const tErr = useTranslations("errors");
  return useMutation({
    mutationFn: (jobId: string) => importService.apply(jobId),
    onSuccess: () => {
      toast.success(t("applySuccess"));
    },
    onError: (err: Error) => {
      if (err instanceof ApiError && err.statusCode === 409) {
        toast.error(t("errorInvalidState"));
        return;
      }
      toast.error(translateError(err, tErr));
    },
  });
}

export { ACTIVE_STATES, DONE_STATES };
