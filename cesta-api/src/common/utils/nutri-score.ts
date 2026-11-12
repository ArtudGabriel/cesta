// Nutri-Score simplificado (FSA/Santé Publique France).
// Referência: tabelas FSA 2017; versão sem modificadores por categoria
// (bebidas, queijos, frutas/verduras) — ver fase 2 Sprint 29.

export type NutriGrade = 'A' | 'B' | 'C' | 'D' | 'E';

export type NutriComparisonUnit =
  | 'KILOGRAM'
  | 'LITER'
  | 'UNIT'
  | 'GRAM'
  | 'MILLILITER';

export interface NutriScoreInput {
  calories: number | null;
  sugar: number | null;
  saturatedFat: number | null;
  salt: number | null;
  fiber: number | null;
  protein: number | null;
  nutritionPer: number | null;
  comparisonUnit: NutriComparisonUnit;
}

export interface NutriScoreResult {
  score: number;
  grade: NutriGrade;
}

// Thresholds (per 100g/100ml). pointsFor devolve número de pontos
// baseado em quantos limites o valor ultrapassa.
const ENERGY_KCAL_STEPS = [80, 160, 240, 320, 400, 480, 560, 640, 720, 800];
const SUGAR_STEPS = [4.5, 9, 13.5, 18, 22.5, 27, 31, 36, 40, 45];
const SAT_FAT_STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const SODIUM_MG_STEPS = [90, 180, 270, 360, 450, 540, 630, 720, 810, 900];
const FIBER_STEPS = [0.9, 1.9, 2.8, 3.7, 4.7];
const PROTEIN_STEPS = [1.6, 3.2, 4.8, 6.4, 8.0];

function pointsFor(value: number, steps: number[]): number {
  let points = 0;
  for (const threshold of steps) {
    if (value > threshold) points += 1;
    else break;
  }
  return points;
}

function gradeOf(score: number): NutriGrade {
  if (score <= -1) return 'A';
  if (score <= 2) return 'B';
  if (score <= 10) return 'C';
  if (score <= 18) return 'D';
  return 'E';
}

export function calculateNutriScore(
  input: NutriScoreInput,
): NutriScoreResult | null {
  // Embalagens vendidas por unidade sem dados normalizados por 100g/ml.
  if (input.comparisonUnit === 'UNIT') return null;

  const essentials = [
    input.calories,
    input.sugar,
    input.saturatedFat,
    input.salt,
    input.fiber,
    input.protein,
  ];
  const nullCount = essentials.filter((v) => v === null).length;
  // Mais de 2 campos essenciais ausentes = resultado opaco.
  if (nullCount > 2) return null;

  const calories = input.calories ?? 0;
  const sugar = input.sugar ?? 0;
  const satFat = input.saturatedFat ?? 0;
  const salt = input.salt ?? 0;
  const fiber = input.fiber ?? 0;
  const protein = input.protein ?? 0;

  const sodiumMg = salt * 400; // 1g sal ≈ 400mg sódio

  const negative =
    pointsFor(calories, ENERGY_KCAL_STEPS) +
    pointsFor(sugar, SUGAR_STEPS) +
    pointsFor(satFat, SAT_FAT_STEPS) +
    pointsFor(sodiumMg, SODIUM_MG_STEPS);

  const positive =
    pointsFor(fiber, FIBER_STEPS) + pointsFor(protein, PROTEIN_STEPS);

  const score = negative - positive;
  return { score, grade: gradeOf(score) };
}
