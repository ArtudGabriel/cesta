/**
 * Sprint 165 — client-side fallback para calcular preço por medida padronizada
 * quando backend não popular `cheapestUnitPrice` (edge case produtos novos sem
 * category). Mesma lógica do backend `ComparisonUnit` mapper.
 *
 * Grounding: cesta.md §3.2 "Comparação por Medida Padronizada" é core UVP.
 */
import type { MeasureUnit, UnitPriceSuffix } from "../types/catalog.types";

export interface CalcUnitPriceResult {
  value: number;
  unit: UnitPriceSuffix;
}

const SUFFIX_BY_UNIT: Record<Exclude<MeasureUnit, "UNIT">, UnitPriceSuffix> = {
  LITER: "L",
  MILLILITER: "100ml",
  KILOGRAM: "kg",
  GRAM: "100g",
};

export function calcUnitPrice(
  price: number | null | undefined,
  packageSize: number | null | undefined,
  comparisonUnit: MeasureUnit,
): CalcUnitPriceResult | null {
  if (price == null || packageSize == null || packageSize <= 0) return null;
  if (!Number.isFinite(price) || !Number.isFinite(packageSize)) return null;

  // Produtos vendidos por unidade (ex: 1 pack ovo, 1 escova dentes) não
  // comparam por medida — preço absoluto já é a unidade.
  if (comparisonUnit === "UNIT") return null;

  const suffix = SUFFIX_BY_UNIT[comparisonUnit];
  // 100g / 100ml: dividido por (packageSize/100). kg / L: dividido por packageSize direto.
  const divisor =
    comparisonUnit === "GRAM" || comparisonUnit === "MILLILITER"
      ? packageSize / 100
      : packageSize;
  if (divisor <= 0) return null;

  const value = Math.round((price / divisor) * 100) / 100;
  return { value, unit: suffix };
}
