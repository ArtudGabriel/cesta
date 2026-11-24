"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import * as Sentry from "@sentry/nextjs";
import { toast } from "sonner";
import { translateError } from "@/lib/translate-error";
import { alertsService } from "../services/alerts.service";
import type {
  AlertRule,
  AlertRuleType,
  BundleRulePayload,
  ComboRulePayload,
  CreateAlertPayload,
  TrendRulePayload,
} from "../types/alert.types";

export const ALERT_KEYS = {
  all: ["alerts"] as const,
  rules: ["alerts", "rules"] as const,
};

export function useAlerts() {
  return useQuery({
    queryKey: ALERT_KEYS.all,
    queryFn: alertsService.list,
  });
}

export function useAlertRules() {
  return useQuery({
    queryKey: ALERT_KEYS.rules,
    queryFn: () => alertsService.listRules(),
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

// Sprint 159 — mutation unificada pra criar rules combo/trend/bundle via wizard.
// Garante cache invalidation + toast feedback + Sentry capture; antes o wizard
// chamava o service direto e erros ficavam silent abaixo do fold.
type CreateRuleArgs =
  | { type: "combo"; payload: ComboRulePayload }
  | { type: "trend"; payload: TrendRulePayload }
  | { type: "bundle"; payload: BundleRulePayload };

export function useCreateAlertRule(options?: {
  onSuccess?: (rule: AlertRule, type: AlertRuleType) => void;
  onError?: (err: Error) => void;
}) {
  const qc = useQueryClient();
  const tErr = useTranslations("errors");
  const tRules = useTranslations("alerts.rules");
  return useMutation({
    mutationFn: async (args: CreateRuleArgs): Promise<AlertRule> => {
      if (args.type === "combo") return alertsService.createCombo(args.payload);
      if (args.type === "trend") return alertsService.createTrend(args.payload);
      return alertsService.createBundle(args.payload);
    },
    onSuccess: (rule, vars) => {
      qc.invalidateQueries({ queryKey: ALERT_KEYS.rules });
      toast.success(tRules("success.ruleCreated"));
      options?.onSuccess?.(rule, vars.type);
    },
    onError: (err: Error, vars) => {
      Sentry.captureException(err, {
        tags: { feature: "alerts", action: "createRule", ruleType: vars.type },
      });
      const msg = translateError(err, tErr);
      toast.error(msg);
      options?.onError?.(err);
    },
  });
}

// Sprint 160 — rule card inline actions
export function useToggleAlertRule() {
  const qc = useQueryClient();
  const tErr = useTranslations("errors");
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      alertsService.toggleRule(id, isActive),
    onMutate: async ({ id, isActive }) => {
      // Optimistic: muda isActive imediato pra feedback visual.
      await qc.cancelQueries({ queryKey: ALERT_KEYS.rules });
      const prev = qc.getQueryData<AlertRule[]>(ALERT_KEYS.rules);
      qc.setQueryData<AlertRule[]>(ALERT_KEYS.rules, (old) =>
        Array.isArray(old)
          ? old.map((r) => (r.id === id ? { ...r, isActive } : r))
          : old,
      );
      return { prev };
    },
    onError: (err: Error, _vars, ctx) => {
      Sentry.captureException(err, {
        tags: { feature: "alerts", action: "toggleRule" },
      });
      if (ctx?.prev !== undefined) qc.setQueryData(ALERT_KEYS.rules, ctx.prev);
      toast.error(translateError(err, tErr));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ALERT_KEYS.rules });
    },
  });
}

export function useDeleteAlertRule() {
  const qc = useQueryClient();
  const tErr = useTranslations("errors");
  const tRules = useTranslations("alerts.rules");
  return useMutation({
    mutationFn: (id: string) => alertsService.removeRule(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ALERT_KEYS.rules });
      const prev = qc.getQueryData<AlertRule[]>(ALERT_KEYS.rules);
      qc.setQueryData<AlertRule[]>(ALERT_KEYS.rules, (old) =>
        Array.isArray(old) ? old.filter((r) => r.id !== id) : old,
      );
      return { prev };
    },
    onError: (err: Error, _id, ctx) => {
      Sentry.captureException(err, {
        tags: { feature: "alerts", action: "deleteRule" },
      });
      if (ctx?.prev !== undefined) qc.setQueryData(ALERT_KEYS.rules, ctx.prev);
      toast.error(translateError(err, tErr));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ALERT_KEYS.rules });
      toast.success(tRules("success.ruleDeleted"));
    },
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
