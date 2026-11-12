import type { UnitPrice, UnitPriceSuffix } from "../types/catalog.types";

type Locale = "es" | "pt-BR";

const INTL_LOCALE: Record<Locale, string> = {
  es: "es-ES",
  "pt-BR": "pt-BR",
};

export function formatUnitPrice(
  up: UnitPrice | null | undefined,
  locale: Locale = "es",
): string | null {
  if (!up) return null;
  const value = new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(up.value);
  return `${value}/${up.unit}`;
}

export function normalizedNote(locale: Locale = "es"): string {
  return locale === "pt-BR"
    ? "Comparação normalizada por unidade"
    : "Comparación normalizada por unidad";
}

export function unitSuffix(unit: UnitPriceSuffix): string {
  return unit;
}
