"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AUDIT_LOG_TYPES, type AuditLogType } from "../types/audit";

/**
 * Sprint 104: filtro multi-select (toggle chip). URL query `type` CSV; `type`
 * vazio significa sem filtro. Mudança reseta offset (nova página 1). Usa
 * useTransition pra manter UI responsiva durante refetch RSC.
 */
export function AuditLogFilter() {
  const t = useTranslations("admin.audit");
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const active = params.get("type")?.split(",").filter(Boolean) ?? [];

  const toggle = useCallback(
    (type: AuditLogType) => {
      const next = active.includes(type)
        ? active.filter((t) => t !== type)
        : [...active, type];
      const qs = new URLSearchParams(params.toString());
      if (next.length > 0) qs.set("type", next.join(","));
      else qs.delete("type");
      qs.delete("offset");
      startTransition(() => {
        router.push(`?${qs.toString()}`, { scroll: false });
      });
    },
    [active, params, router],
  );

  const clear = useCallback(() => {
    const qs = new URLSearchParams(params.toString());
    qs.delete("type");
    qs.delete("offset");
    startTransition(() => {
      router.push(`?${qs.toString()}`, { scroll: false });
    });
  }, [params, router]);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        isPending && "opacity-50",
      )}
    >
      <span className="inline-flex items-center gap-1 text-[11px] text-muted">
        <Filter className="h-3 w-3" aria-hidden />
        {t("filter.label")}
      </span>
      {AUDIT_LOG_TYPES.map((type) => {
        const on = active.includes(type);
        return (
          <button
            key={type}
            type="button"
            onClick={() => toggle(type)}
            aria-pressed={on}
            className={cn(
              "rounded-pill border px-2 py-0.5 text-[11px] font-medium transition",
              on
                ? "border-cesta-green bg-cesta-green text-white"
                : "border-border bg-white text-ink hover:border-cesta-green",
            )}
          >
            {t(`types.${type}`)}
          </button>
        );
      })}
      {active.length > 0 && (
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center gap-1 rounded-pill border border-border bg-white px-2 py-0.5 text-[11px] font-medium text-muted hover:text-ink"
          aria-label={t("filter.clear")}
        >
          <X className="h-3 w-3" aria-hidden />
          {t("filter.clear")}
        </button>
      )}
    </div>
  );
}
