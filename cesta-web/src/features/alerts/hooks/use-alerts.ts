"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { translateError } from "@/lib/translate-error";
import { alertsService } from "../services/alerts.service";
import type { CreateAlertPayload } from "../types/alert.types";

export const ALERT_KEYS = {
  all: ["alerts"] as const,
};

export function useAlerts() {
  return useQuery({
    queryKey: ALERT_KEYS.all,
    queryFn: alertsService.list,
  });
}

export function useCreateAlert() {
  const qc = useQueryClient();
  const tErr = useTranslations("errors");
  return useMutation({
    mutationFn: (payload: CreateAlertPayload) => alertsService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ALERT_KEYS.all });
      toast.success("Alerta creada");
    },
    onError: (err: Error) => toast.error(translateError(err, tErr)),
  });
}

export function useToggleAlert() {
  const qc = useQueryClient();
  const tErr = useTranslations("errors");
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      alertsService.toggle(id, isActive),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ALERT_KEYS.all });
    },
    onError: (err: Error) => toast.error(translateError(err, tErr)),
  });
}

export function useDeleteAlert() {
  const qc = useQueryClient();
  const tErr = useTranslations("errors");
  return useMutation({
    mutationFn: (id: string) => alertsService.remove(id),
    onMutate: async (id) => {
      // Optimistic: remove do cache imediatamente pra feedback visual rápido.
      await qc.cancelQueries({ queryKey: ALERT_KEYS.all });
      const prev = qc.getQueryData<CreateAlertPayload[]>(ALERT_KEYS.all);
      qc.setQueryData<unknown[]>(ALERT_KEYS.all, (old) => {
        if (!Array.isArray(old)) return old;
        return old.filter((a) => (a as { id?: string }).id !== id);
      });
      return { prev };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ALERT_KEYS.all });
      toast.success("Alerta eliminada");
    },
    onError: (err: Error, _id, ctx) => {
      // Restaura cache em caso de falha.
      if (ctx?.prev !== undefined) qc.setQueryData(ALERT_KEYS.all, ctx.prev);
      toast.error(translateError(err, tErr));
    },
  });
}
