"use client";

import { Leaf, MilkOff, Salad, Wheat, type LucideIcon } from "lucide-react";
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
  const items: Array<{
    show: boolean;
    label: string;
    Icon: LucideIcon;
    className: string;
  }> = [
    {
      show: product.isVegan,
      label: t("vegan"),
      Icon: Leaf,
      className: "bg-lima/20 text-cesta-green-dark",
    },
    {
      show: product.isVegetarian,
      label: t("vegetarian"),
      Icon: Salad,
      className: "bg-lima/20 text-cesta-green-dark",
    },
    {
      show: product.isGlutenFree,
      label: t("glutenFree"),
      Icon: Wheat,
      className: "bg-amber/20 text-amber-700",
    },
    {
      show: product.isLactoseFree,
      label: t("lactoseFree"),
      Icon: MilkOff,
      className: "bg-cream text-cesta-green-dark border border-cesta-green/30",
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
          <item.Icon className="h-3 w-3" aria-hidden />
          {item.label}
        </span>
      ))}
    </div>
  );
}
