"use client";

import { Leaf, MilkOff, Salad, Wheat } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type DietaryFlag = "vegan" | "vegetarian" | "glutenFree" | "lactoseFree";

const ORDER: DietaryFlag[] = ["vegan", "vegetarian", "glutenFree", "lactoseFree"];
const ICONS: Record<DietaryFlag, typeof Leaf> = {
  vegan: Leaf,
  vegetarian: Salad,
  glutenFree: Wheat,
  lactoseFree: MilkOff,
};

interface DietaryFiltersProps {
  active: Set<DietaryFlag>;
  onToggle: (flag: DietaryFlag) => void;
}

export function DietaryFilters({ active, onToggle }: DietaryFiltersProps) {
  const t = useTranslations("product.dietary");

  return (
    // Sprint 59 GDPR: chips dietary são labels i18n (vegan/vegetarian/sin
    // gluten/sin lactosa) — chrome público, não PII.
    <div className="-mx-4 overflow-x-auto px-4" data-sentry-unmask>
      <div className="flex gap-2 pb-1">
        {ORDER.map((flag) => {
          const Icon = ICONS[flag];
          const isActive = active.has(flag);
          return (
            <button
              key={flag}
              type="button"
              onClick={() => onToggle(flag)}
              aria-pressed={isActive}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 rounded-pill px-3 text-xs font-medium whitespace-nowrap cursor-pointer transition-colors",
                isActive
                  ? "bg-cesta-green text-white"
                  : "bg-neutral-100 text-ink hover:bg-neutral-200",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {t(flag)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
