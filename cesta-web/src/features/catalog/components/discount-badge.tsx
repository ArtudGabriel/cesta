import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { DiscountInfo } from "../utils/discount";

interface DiscountBadgeProps {
  discount: DiscountInfo;
  size?: "sm" | "md";
  className?: string;
}

const SEVERITY_CLASSES: Record<DiscountInfo["severity"], string> = {
  low: "bg-cesta-green text-white",
  mid: "bg-amber text-ink",
  high: "bg-coral text-white",
};

const SIZE_CLASSES: Record<NonNullable<DiscountBadgeProps["size"]>, string> = {
  sm: "px-1.5 py-0.5 text-[10px]",
  md: "px-2 py-0.5 text-xs",
};

/**
 * Sprint 154: pill de desconto color-coded.
 * - low (<15%): verde Cesta — leve economia, sem urgência visual
 * - mid (15–29%): âmbar — chama atenção
 * - high (>=30%): coral — oferta agressiva
 */
export function DiscountBadge({
  discount,
  size = "sm",
  className,
}: DiscountBadgeProps) {
  const t = useTranslations("home");
  return (
    <span
      data-sentry-unmask
      className={cn(
        "inline-flex items-center rounded-pill font-bold leading-none",
        SEVERITY_CLASSES[discount.severity],
        SIZE_CLASSES[size],
        className,
      )}
      aria-label={t("discountOffAria", { percent: discount.percent })}
    >
      {t("discountOff", { percent: discount.percent })}
    </span>
  );
}
