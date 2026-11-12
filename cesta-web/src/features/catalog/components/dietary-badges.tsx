"use client";

import { Leaf } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Product } from "../types/catalog.types";

interface DietaryBadgesProps {
  product: Pick<
    Product,
    "isVegan" | "isVegetarian" | "isGlutenFree" | "isLactoseFree"
  >;
}

export function DietaryBadges({ product }: DietaryBadgesProps) {
  const t = useTranslations("product.dietary");
  const items: Array<{ show: boolean; label: string; className: string }> = [
    {
      show: product.isVegan,
      label: t("vegan"),
      className: "bg-lima/20 text-cesta-green-dark",
    },
    {
      show: product.isVegetarian,
      label: t("vegetarian"),
      className: "bg-lima/20 text-cesta-green-dark",
    },
    {
      show: product.isGlutenFree,
      label: t("glutenFree"),
      className: "bg-amber/20 text-amber-700",
    },
    {
      show: product.isLactoseFree,
      label: t("lactoseFree"),
      className: "bg-violet-100 text-violet-700",
    },
  ];

  const visible = items.filter((i) => i.show);
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((item) => (
        <span
          key={item.label}
          className={`inline-flex items-center gap-1 rounded-pill px-3 py-1 text-xs font-medium ${item.className}`}
        >
          <Leaf className="h-3 w-3" aria-hidden />
          {item.label}
        </span>
      ))}
    </div>
  );
}
