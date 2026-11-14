"use client";

import { Award, Leaf } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { NutriGrade } from "../types/catalog.types";

interface NutriFiltersProps {
  sortByNutri: boolean;
  onSortByNutriChange: (value: boolean) => void;
  onlyHealthy: boolean;
  onOnlyHealthyChange: (value: boolean) => void;
  className?: string;
}

export const NUTRI_GRADE_ORDER: Record<NutriGrade, number> = {
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  E: 4,
};

export function isHealthyGrade(grade: NutriGrade | undefined | null): boolean {
  return grade === "A" || grade === "B";
}

export function nutriSortValue(grade: NutriGrade | undefined | null): number {
  return grade ? NUTRI_GRADE_ORDER[grade] : 99;
}

export function NutriFilters({
  sortByNutri,
  onSortByNutriChange,
  onlyHealthy,
  onOnlyHealthyChange,
  className,
}: NutriFiltersProps) {
  const t = useTranslations("catalog.nutriFilters");
  return (
    // Sprint 59 GDPR: labels de filtro são chrome i18n público (não PII).
    <div
      data-sentry-unmask
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      <button
        type="button"
        onClick={() => onSortByNutriChange(!sortByNutri)}
        aria-pressed={sortByNutri}
        className={cn(
          "inline-flex items-center gap-1 rounded-pill px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors",
          sortByNutri
            ? "bg-cesta-green text-white"
            : "bg-surface text-muted hover:text-ink",
        )}
      >
        <Award className="h-3.5 w-3.5" />
        {t("sortByNutri")}
      </button>
      <button
        type="button"
        onClick={() => onOnlyHealthyChange(!onlyHealthy)}
        aria-pressed={onlyHealthy}
        className={cn(
          "inline-flex items-center gap-1 rounded-pill px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors",
          onlyHealthy
            ? "bg-cesta-green text-white"
            : "bg-surface text-muted hover:text-ink",
        )}
      >
        <Leaf className="h-3.5 w-3.5" />
        {t("onlyHealthy")}
      </button>
    </div>
  );
}
