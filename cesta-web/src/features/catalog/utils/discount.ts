/**
 * Sprint 154: cálculo de desconto baseado em previousPrice vs currentPrice.
 * Retorna `null` quando não há oferta real (valores ausentes, igual ou
 * previousPrice ≤ currentPrice).
 */
export interface DiscountInfo {
  /** Porcentagem inteira (ex: 25 significa -25%). */
  percent: number;
  /** Severity bucket pra color-coding da badge. */
  severity: "low" | "mid" | "high";
}

export function calculateDiscount(input: {
  previousPrice: number | null | undefined;
  currentPrice: number | null | undefined;
}): DiscountInfo | null {
  const prev = input.previousPrice;
  const curr = input.currentPrice;
  if (prev == null || curr == null) return null;
  if (!Number.isFinite(prev) || !Number.isFinite(curr)) return null;
  if (prev <= 0 || curr <= 0) return null;
  if (prev <= curr) return null;
  const rawPercent = ((prev - curr) / prev) * 100;
  const percent = Math.round(rawPercent);
  if (percent <= 0) return null;
  const severity: DiscountInfo["severity"] =
    percent >= 30 ? "high" : percent >= 15 ? "mid" : "low";
  return { percent, severity };
}
