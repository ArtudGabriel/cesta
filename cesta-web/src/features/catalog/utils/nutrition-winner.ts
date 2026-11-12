export type Nutrient =
  | "calories"
  | "fat"
  | "saturatedFat"
  | "carbs"
  | "sugar"
  | "salt"
  | "fiber"
  | "protein";

export type Direction = "lower" | "higher";

export const DIRECTIONS: Record<Nutrient, Direction> = {
  calories: "lower",
  fat: "lower",
  saturatedFat: "lower",
  carbs: "lower",
  sugar: "lower",
  salt: "lower",
  fiber: "higher",
  protein: "higher",
};

export const NUTRIENTS = Object.keys(DIRECTIONS) as Nutrient[];

type ProductLike = { id: string } & Partial<Record<Nutrient, number | null>>;

/**
 * Picks the winner productId for a given nutrient among `products`.
 * Returns null when:
 * - fewer than 2 products have a numeric value for the nutrient
 * - 2+ products tie for the best value (ambiguous winner)
 */
export function pickBest<T extends ProductLike>(
  products: T[],
  nutrient: Nutrient,
): string | null {
  const values = products
    .map((p) => ({ id: p.id, value: p[nutrient] }))
    .filter((v): v is { id: string; value: number } => typeof v.value === "number");

  if (values.length < 2) return null;

  const dir = DIRECTIONS[nutrient];
  const winner = values.reduce((best, cur) =>
    dir === "lower"
      ? cur.value < best.value
        ? cur
        : best
      : cur.value > best.value
        ? cur
        : best,
  );

  const sameAsWinner = values.filter((v) => v.value === winner.value);
  return sameAsWinner.length === 1 ? winner.id : null;
}

/**
 * Builds a map: productId -> Set<nutrient onde esse produto é vencedor>.
 */
export function computeWinnerSets<T extends ProductLike>(
  products: T[],
): Map<string, Set<Nutrient>> {
  const map = new Map<string, Set<Nutrient>>();
  for (const p of products) map.set(p.id, new Set());

  for (const nutrient of NUTRIENTS) {
    const winnerId = pickBest(products, nutrient);
    if (winnerId) map.get(winnerId)?.add(nutrient);
  }

  return map;
}
