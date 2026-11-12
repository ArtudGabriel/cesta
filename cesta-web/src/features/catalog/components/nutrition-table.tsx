"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { DIRECTIONS, type Nutrient } from "../utils/nutrition-winner";
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

interface NutritionTableProps {
  product: NutritionProduct;
  compact?: boolean;
  winnerNutrients?: Set<Nutrient>;
}

export function NutritionTable({
  product,
  compact = false,
  winnerNutrients,
}: NutritionTableProps) {
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

  const winnerFor = (n: Nutrient) => winnerNutrients?.has(n) ?? false;

  const body = (
    <div className="rounded-card bg-white p-4 shadow-card">
      <p className="mb-3 text-xs text-muted">{t(perLabelKey(product.comparisonUnit))}</p>
      <dl className="divide-y divide-border/50 text-sm">
        <Row
          label={t("calories")}
          value={formatValue(product.calories, "kcal")}
          nutrient="calories"
          isWinner={winnerFor("calories")}
          compact={compact}
        />
        <Row
          label={t("fat")}
          value={formatValue(product.fat, "g")}
          nutrient="fat"
          isWinner={winnerFor("fat")}
          compact={compact}
        >
          {product.saturatedFat !== null && (
            <SubRow
              label={`${t("ofWhich")} ${t("saturatedFat")}`}
              value={formatValue(product.saturatedFat, "g")}
              nutrient="saturatedFat"
              isWinner={winnerFor("saturatedFat")}
            />
          )}
        </Row>
        <Row
          label={t("carbs")}
          value={formatValue(product.carbs, "g")}
          nutrient="carbs"
          isWinner={winnerFor("carbs")}
          compact={compact}
        >
          {product.sugar !== null && (
            <SubRow
              label={`${t("ofWhich")} ${t("sugar")}`}
              value={formatValue(product.sugar, "g")}
              nutrient="sugar"
              isWinner={winnerFor("sugar")}
            />
          )}
        </Row>
        <Row
          label={t("fiber")}
          value={formatValue(product.fiber, "g")}
          nutrient="fiber"
          isWinner={winnerFor("fiber")}
          compact={compact}
        />
        <Row
          label={t("protein")}
          value={formatValue(product.protein, "g")}
          nutrient="protein"
          isWinner={winnerFor("protein")}
          compact={compact}
        />
        <Row
          label={t("salt")}
          value={formatValue(product.salt, "g")}
          nutrient="salt"
          isWinner={winnerFor("salt")}
          compact={compact}
        />
      </dl>
    </div>
  );

  if (compact) return body;

  return (
    <section className="px-4 py-4">
      <h3 className="mb-3 font-display text-lg font-bold text-ink">{t("title")}</h3>
      {body}
    </section>
  );
}

function WinnerBadge({ nutrient }: { nutrient: Nutrient }) {
  const t = useTranslations("product.nutrition");
  const Icon = DIRECTIONS[nutrient] === "lower" ? ArrowDown : ArrowUp;
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-pill bg-lima/40 px-1.5 py-0.5 text-[10px] font-semibold text-cesta-green-dark"
      aria-label={t("winnerLabel")}
    >
      <Icon className="h-3 w-3" aria-hidden />
    </span>
  );
}

function Row({
  label,
  value,
  nutrient,
  isWinner,
  compact,
  children,
}: {
  label: string;
  value: string;
  nutrient: Nutrient;
  isWinner: boolean;
  compact?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn(compact ? "py-1" : "py-2")}>
      <div className="flex items-center justify-between gap-2">
        <dt className="text-muted">{label}</dt>
        <dd className={cn(
          "flex items-center gap-1.5 font-medium",
          value === "—" ? "text-neutral-300" : "text-ink",
        )}>
          <span>{value}</span>
          {isWinner && value !== "—" && <WinnerBadge nutrient={nutrient} />}
        </dd>
      </div>
      {children}
    </div>
  );
}

function SubRow({
  label,
  value,
  nutrient,
  isWinner,
}: {
  label: string;
  value: string;
  nutrient: Nutrient;
  isWinner: boolean;
}) {
  return (
    <div className="mt-1 flex items-center justify-between gap-2 pl-4 text-xs">
      <dt className="text-muted">{label}</dt>
      <dd className={cn(
        "flex items-center gap-1",
        value === "—" ? "text-neutral-300" : "text-neutral-500",
      )}>
        <span>{value}</span>
        {isWinner && value !== "—" && <WinnerBadge nutrient={nutrient} />}
      </dd>
    </div>
  );
}
