"use client";

import { useTranslations } from "next-intl";
import type { MeasureUnit, Product } from "../types/catalog.types";

type NutritionProduct = Pick<
  Product,
  | "calories"
  | "protein"
  | "fat"
  | "saturatedFat"
  | "carbs"
  | "sugar"
  | "salt"
  | "fiber"
  | "nutritionPer"
  | "comparisonUnit"
>;

function perLabelKey(unit: MeasureUnit): "per100g" | "per100ml" | "perUnit" {
  if (unit === "GRAM" || unit === "KILOGRAM") return "per100g";
  if (unit === "LITER" || unit === "MILLILITER") return "per100ml";
  return "perUnit";
}

function formatValue(v: number | null, suffix: string): string {
  if (v === null) return "—";
  const rounded = Math.round(v * 10) / 10;
  return `${rounded} ${suffix}`;
}

export function NutritionTable({ product }: { product: NutritionProduct }) {
  const t = useTranslations("product.nutrition");

  const hasAny =
    product.calories !== null ||
    product.protein !== null ||
    product.fat !== null ||
    product.saturatedFat !== null ||
    product.carbs !== null ||
    product.sugar !== null ||
    product.salt !== null ||
    product.fiber !== null;

  if (!hasAny) return null;

  return (
    <div className="rounded-card bg-white p-4 shadow-card">
      <p className="mb-3 text-xs text-muted">{t(perLabelKey(product.comparisonUnit))}</p>
      <dl className="divide-y divide-border/50 text-sm">
        <Row label={t("calories")} value={formatValue(product.calories, "kcal")} />
        <Row label={t("fat")} value={formatValue(product.fat, "g")}>
          {product.saturatedFat !== null && (
            <SubRow
              label={`${t("ofWhich")} ${t("saturatedFat")}`}
              value={formatValue(product.saturatedFat, "g")}
            />
          )}
        </Row>
        <Row label={t("carbs")} value={formatValue(product.carbs, "g")}>
          {product.sugar !== null && (
            <SubRow
              label={`${t("ofWhich")} ${t("sugar")}`}
              value={formatValue(product.sugar, "g")}
            />
          )}
        </Row>
        <Row label={t("fiber")} value={formatValue(product.fiber, "g")} />
        <Row label={t("protein")} value={formatValue(product.protein, "g")} />
        <Row label={t("salt")} value={formatValue(product.salt, "g")} />
      </dl>
    </div>
  );
}

function Row({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="py-2">
      <div className="flex items-center justify-between">
        <dt className="text-muted">{label}</dt>
        <dd className={`font-medium ${value === "—" ? "text-neutral-300" : "text-ink"}`}>
          {value}
        </dd>
      </div>
      {children}
    </div>
  );
}

function SubRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-1 flex items-center justify-between pl-4 text-xs">
      <dt className="text-muted">{label}</dt>
      <dd className={`${value === "—" ? "text-neutral-300" : "text-neutral-500"}`}>
        {value}
      </dd>
    </div>
  );
}
