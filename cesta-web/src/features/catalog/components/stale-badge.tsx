"use client";

import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface StaleBadgeProps {
  size?: "sm" | "md";
  className?: string;
}

/**
 * Sprint 226 (ADR 0034): chip de aviso quando preço cheapest / por mercado
 * não é atualizado há mais de `PRICE_STALE_THRESHOLD_HOURS` (default 48h).
 * Consome `product.isStale` ou `price.isStale` do backend. Não decide
 * localmente — zero fetch extra, zero Date.now.
 *
 * `data-sentry-unmask` é opcional (chrome diagnostic pra Session Replay);
 * NÃO é requisito GDPR — o default do SDK já mascara por `maskAllText`, só
 * campos com PII precisariam de `data-sentry-mask` explícito. Aqui é
 * catálogo público (estado do preço), e marcar unmask apenas facilita
 * reproduzir bugs de badge sem trocar config do Replay.
 */
export function StaleBadge({ size = "sm", className }: StaleBadgeProps) {
  const t = useTranslations("catalog.stale");
  const padding = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  return (
    <span
      data-sentry-unmask
      data-testid="stale-badge"
      role="status"
      aria-label={t("tooltip")}
      title={t("tooltip")}
      className={cn(
        "inline-flex items-center gap-1 rounded-pill bg-amber-100 font-medium text-amber-800",
        padding,
        className,
      )}
    >
      <Clock className={iconSize} aria-hidden />
      {t("label")}
    </span>
  );
}
