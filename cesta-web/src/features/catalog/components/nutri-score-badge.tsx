import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { NutriGrade } from "../types/catalog.types";

interface NutriScoreBadgeProps {
  grade: NutriGrade | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const GRADE_COLORS: Record<NutriGrade, string> = {
  A: "bg-[#008A3F] text-white",
  B: "bg-[#5BB630] text-white",
  C: "bg-[#F5C500] text-ink",
  D: "bg-[#F18C1C] text-white",
  E: "bg-[#D60018] text-white",
};

const SIZE_CLASSES: Record<NonNullable<NutriScoreBadgeProps["size"]>, string> = {
  sm: "h-6 w-6 text-xs",
  md: "h-10 w-10 text-base",
  lg: "h-14 w-14 text-xl font-bold",
};

export function NutriScoreBadge({
  grade,
  size = "md",
  className,
}: NutriScoreBadgeProps) {
  const t = useTranslations("product.nutriScore");
  if (grade === null) return null;
  return (
    <span
      role="img"
      aria-label={t("aria.badge", { grade })}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-semibold leading-none",
        GRADE_COLORS[grade],
        SIZE_CLASSES[size],
        className,
      )}
    >
      {grade}
    </span>
  );
}
