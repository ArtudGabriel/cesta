"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
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
  return useMutation({
    mutationFn: (payload: CreateAlertPayload) => alertsService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ALERT_KEYS.all });
      toast.success("Alerta creada");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useToggleAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      alertsService.toggle(id, isActive),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ALERT_KEYS.all });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => alertsService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ALERT_KEYS.all });
      toast.success("Alerta eliminada");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
