import type { UnitPrice } from "../types/catalog.types";

type Locale = "es" | "pt-BR";

const INTL_LOCALE: Record<Locale, string> = {
  es: "es-ES",
  "pt-BR": "pt-BR",
};

// Sprint 118 — style:'decimal' ao invés de 'currency'. Intl pt-BR com EUR
// prepend "€ 4,20" enquanto es-ES append "4,20 €"; o símbolo fica em dois
// lugares diferentes entre locales e, quando combinado com labels/ícones de
// UI que já marcam a unidade, parece duplicado no PDP. Formatamos só o
// número e concatenamos "€" no mesmo lugar sempre.
export function formatUnitPrice(
  up: UnitPrice | null | undefined,
  locale: Locale = "es",
): string | null {
  if (!up) return null;
  const value = new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(up.value);
  return `${value} €/${up.unit}`;
}
