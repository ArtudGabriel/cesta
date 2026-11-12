"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DietaryFlag } from "./dietary-filters";

interface DietaryWarningProps {
  product: {
    isVegan: boolean;
    isVegetarian: boolean;
    isGlutenFree: boolean;
    isLactoseFree: boolean;
  };
  preferences: Set<DietaryFlag>;
}

const FLAG_TO_PRODUCT_KEY = {
  vegan: "isVegan",
  vegetarian: "isVegetarian",
  glutenFree: "isGlutenFree",
  lactoseFree: "isLactoseFree",
} as const;

export function DietaryWarning({ product, preferences }: DietaryWarningProps) {
  const t = useTranslations("product.dietary");
  const tCompare = useTranslations("compare.dietary");

  if (preferences.size === 0) return null;

  const violations: DietaryFlag[] = [];
  for (const flag of preferences) {
    const key = FLAG_TO_PRODUCT_KEY[flag];
    if (!product[key]) violations.push(flag);
  }

  if (violations.length === 0) return null;

  const labels = violations.map((v) => t(v)).join(", ");

  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-coral/10 px-2 py-0.5 text-[11px] font-medium text-coral">
      <AlertTriangle className="h-3 w-3" aria-hidden />
      {tCompare("warning", { restrictions: labels })}
    </span>
  );
}
