"use client";

import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Sprint 244 (ADR 0044): badge verde "mismo producto" / "mesmo produto".
 * Render condicional: `isSameProduct === true` (canonicalGroupSize > 1).
 * Mercado-agnostic — não renderiza nome de supermarket, só count.
 * GDPR-safe: zero PII (nome produto vem do catálogo público).
 *
 * size="sm" vai em card list; size="md" vai no detalhe.
 */
export function SameProductBadge({
  count,
  size = "sm",
  className,
}: {
  count: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const t = useTranslations("product");
  const label = size === "sm" ? t("sameProductBadgeShort") : t("sameProductBadge");
  const tooltip = t("sameProductTooltip", { count });
  return (
    <span
      data-sentry-unmask
      data-testid="same-product-badge"
      data-count={count}
      title={tooltip}
      aria-label={tooltip}
      className={cn(
        "inline-flex items-center gap-1 rounded-pill bg-cesta-green px-2 py-0.5 font-medium text-white",
        size === "sm" ? "text-[10px]" : "text-xs",
        className,
      )}
    >
      <CheckCircle2
        className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")}
        aria-hidden
      />
      <span>
        {label} · {count}
      </span>
    </span>
  );
}
