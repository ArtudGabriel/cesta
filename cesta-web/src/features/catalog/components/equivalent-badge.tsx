"use client";

import { Shuffle } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn, formatPrice } from "@/lib/utils";

/**
 * Sprint 245 (ADR 0046): badge amarelo "equivalente desde X€".
 *
 * Render condicional: produto tem `equivalentGroupId`, `equivalentCount > 1`
 * e `cheapestEquivalent` populado (outro membro do grupo com preço ativo
 * menor que este). Diferente do `SameProductBadge` (mismo producto · verde ·
 * mesma marca cross-mercado), este destaca produto de MARCA DIFERENTE que
 * serve ao mesmo propósito e sai mais barato.
 *
 * i18n: "Equivalente desde X€" / "Equivalente desde X€". Tooltip carrega
 * brand, supermarket e count (ambos locais). GDPR-safe (zero PII).
 */
export function EquivalentBadge({
  cheapest,
  count,
  size = "sm",
  className,
}: {
  cheapest: {
    price: number;
    brand?: string | null;
    supermarketName: string;
  };
  count: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const t = useTranslations("product");
  const priceStr = formatPrice(cheapest.price);
  const label =
    size === "sm"
      ? t("equivalentBadgeShort", { price: priceStr })
      : t("equivalentBadge", { price: priceStr });
  const tooltip = t("equivalentTooltip", {
    brand: cheapest.brand ?? "—",
    supermarket: cheapest.supermarketName,
    count,
  });
  return (
    <span
      data-sentry-unmask
      data-testid="equivalent-badge"
      data-count={count}
      title={tooltip}
      aria-label={tooltip}
      className={cn(
        // Sprint 245 (Reviewer AJUSTE 2026-11-28): token design system
        // `bg-amber` (#F59E0B) — cesta-identidade-visual.md §3.2 Âmbar
        // pra "alertas de preço, urgência moderada, destaque", exact
        // use case do badge equivalente. `text-ink` (#2A2420) contra
        // amber L*72 → contrast ~9+ (AAA).
        "inline-flex items-center gap-1 rounded-pill bg-amber px-2 py-0.5 font-medium text-ink",
        size === "sm" ? "text-[10px]" : "text-xs",
        className,
      )}
    >
      <Shuffle
        className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")}
        aria-hidden
      />
      <span>{label}</span>
    </span>
  );
}
