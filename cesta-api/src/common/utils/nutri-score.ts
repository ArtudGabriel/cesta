// Nutri-Score (FSA / Santé Publique France) com 4 variantes por categoria.
// Sprint 61 substitui a versão simplificada da Sprint 29 (replace in place).
//
// Escalas em kJ (oficial), calorias em kcal são convertidas via 1 kcal ≈ 4.184 kJ.
// Fonte: Santé Publique France — "Système d'étiquetage nutritionnel Nutri-Score"
// (revisão 2023). Escalas de bebidas e gorduras divergem da escala general;
// queijos têm a positivação de proteínas sem cap.
//
// Observação: implementação pragmática para catálogo PT/ES com dados comuns.
// Alguns refinamentos oficiais (ex.: "aguas minerais → A fixo", "frutas /
// vegetais / nozes bonus na proteína") estão documentados mas não aplicados
// granularmente — categoria mapping (Sprint 61 em products.service) delimita
// o domínio por slug de categoria.

export type NutriGrade = 'A' | 'B' | 'C' | 'D' | 'E';

export type NutriComparisonUnit =
  | 'KILOGRAM'
  | 'LITER'
  | 'UNIT'
  | 'GRAM'
  | 'MILLILITER';

export type NutriCategory = 'general' | 'beverage' | 'fat' | 'cheese';

export interface NutriScoreInput {
  calories: number | null; // kcal / 100g
  sugar: number | null; // g / 100g
  saturatedFat: number | null; // g / 100g
  fat: number | null; // g / 100g (total — usado só na variant `fat`)
  salt: number | null; // g / 100g
  fiber: number | null; // g / 100g
  protein: number | null; // g / 100g
  nutritionPer: number | null;
  comparisonUnit: NutriComparisonUnit;
  category: NutriCategory;
}

export interface NutriScoreResult {
  score: number;
  grade: NutriGrade;
}

const KCAL_TO_KJ = 4.184;

// Negativos general (0-10 pts cada) — valores em kJ, g, mg.
const GENERAL_ENERGY_STEPS_KJ = [
  335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350,
];
const SUGAR_STEPS = [4.5, 9, 13.5, 18, 22.5, 27, 31, 36, 40, 45];
const SAT_FAT_STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const SODIUM_MG_STEPS = [90, 180, 270, 360, 450, 540, 630, 720, 810, 900];

// Positivos (0-5)
const FIBER_STEPS = [0.9, 1.9, 2.8, 3.7, 4.7];
const PROTEIN_STEPS = [1.6, 3.2, 4.8, 6.4, 8.0];

// Bebidas — escalas mais rigorosas pra energia e açúcar.
const BEVERAGE_ENERGY_STEPS_KJ = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270];
const BEVERAGE_SUGAR_STEPS = [0, 1.5, 3, 4.5, 6, 7.5, 9, 10.5, 12, 13.5];

// Fat: ratio satFat/totalFat substitui pontos de sat-fat.
// Steps em percentual.
const FAT_RATIO_STEPS = [10, 16, 22, 28, 34, 40, 46, 52, 58, 64];

function pointsFor(value: number, steps: number[]): number {
  let points = 0;
  for (const threshold of steps) {
    if (value > threshold) points += 1;
    else break;
  }
  return points;
}

function gradeGeneral(score: number): NutriGrade {
  if (score <= -1) return 'A';
  if (score <= 2) return 'B';
  if (score <= 10) return 'C';
  if (score <= 18) return 'D';
  return 'E';
}

function gradeBeverage(score: number, isWater: boolean): NutriGrade {
  // Água mineral e sem adoçante = A. Qualquer outro líquido começa em B.
  if (isWater) return 'A';
  if (score <= 1) return 'B';
  if (score <= 5) return 'C';
  if (score <= 9) return 'D';
  return 'E';
}

/**
 * Nutri-Score com variação por categoria. Mantém o contrato de retorno null
 * da Sprint 29 pra casos sem comparabilidade (UNIT) ou dados faltando.
 */
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

  switch (input.category) {
    case 'beverage':
      return calculateBeverage(input);
    case 'fat':
      return calculateFat(input);
    case 'cheese':
      return calculateCheese(input);
    default:
      return calculateGeneral(input);
  }
}

function toValues(input: NutriScoreInput) {
  return {
    energyKj: (input.calories ?? 0) * KCAL_TO_KJ,
    sugar: input.sugar ?? 0,
    satFat: input.saturatedFat ?? 0,
    fat: input.fat ?? 0,
    salt: input.salt ?? 0,
    fiber: input.fiber ?? 0,
    protein: input.protein ?? 0,
  };
}

function calculateGeneral(input: NutriScoreInput): NutriScoreResult {
  const v = toValues(input);
  const sodiumMg = v.salt * 400;

  const negative =
    pointsFor(v.energyKj, GENERAL_ENERGY_STEPS_KJ) +
    pointsFor(v.sugar, SUGAR_STEPS) +
    pointsFor(v.satFat, SAT_FAT_STEPS) +
    pointsFor(sodiumMg, SODIUM_MG_STEPS);

  const fiberPts = pointsFor(v.fiber, FIBER_STEPS);
  const proteinPts = pointsFor(v.protein, PROTEIN_STEPS);

  // Regra oficial: se negativos ≥ 11 E fiber < 5 pontos, proteína não conta.
  const positive =
    negative >= 11 && fiberPts < 5 ? fiberPts : fiberPts + proteinPts;

  const score = negative - positive;
  return { score, grade: gradeGeneral(score) };
}

function calculateBeverage(input: NutriScoreInput): NutriScoreResult {
  const v = toValues(input);
  const sodiumMg = v.salt * 400;

  // Água mineral: zero calorias, zero açúcar, zero sal, zero gordura.
  const isWater =
    v.energyKj === 0 && v.sugar === 0 && v.satFat === 0 && v.salt === 0;

  const negative =
    pointsFor(v.energyKj, BEVERAGE_ENERGY_STEPS_KJ) +
    pointsFor(v.sugar, BEVERAGE_SUGAR_STEPS) +
    pointsFor(v.satFat, SAT_FAT_STEPS) +
    pointsFor(sodiumMg, SODIUM_MG_STEPS);

  // Fibras/proteínas pouco relevantes em bebidas — a FSA define 0 positivo
  // salvo sucos de frutas puros (fora do escopo pragmático desta sprint).
  const positive = 0;

  const score = negative - positive;
  return { score, grade: gradeBeverage(score, isWater) };
}

function calculateFat(input: NutriScoreInput): NutriScoreResult {
  // Para óleos/gorduras, satFat é substituído pela razão satFat/totalFat.
  // Resto segue general (energia/sugar/sodio + proteína/fibra).
  const v = toValues(input);
  const sodiumMg = v.salt * 400;
  const ratio = v.fat > 0 ? (v.satFat / v.fat) * 100 : 0;

  const negative =
    pointsFor(v.energyKj, GENERAL_ENERGY_STEPS_KJ) +
    pointsFor(v.sugar, SUGAR_STEPS) +
    pointsFor(ratio, FAT_RATIO_STEPS) +
    pointsFor(sodiumMg, SODIUM_MG_STEPS);

  const fiberPts = pointsFor(v.fiber, FIBER_STEPS);
  const proteinPts = pointsFor(v.protein, PROTEIN_STEPS);
  const positive =
    negative >= 11 && fiberPts < 5 ? fiberPts : fiberPts + proteinPts;

  const score = negative - positive;
  return { score, grade: gradeGeneral(score) };
}

function calculateCheese(input: NutriScoreInput): NutriScoreResult {
  // Queijos: proteína sempre conta (sem o cap da regra general).
  // Compensa a gordura saturada naturalmente alta.
  const v = toValues(input);
  const sodiumMg = v.salt * 400;

  const negative =
    pointsFor(v.energyKj, GENERAL_ENERGY_STEPS_KJ) +
    pointsFor(v.sugar, SUGAR_STEPS) +
    pointsFor(v.satFat, SAT_FAT_STEPS) +
    pointsFor(sodiumMg, SODIUM_MG_STEPS);

  const positive =
    pointsFor(v.fiber, FIBER_STEPS) + pointsFor(v.protein, PROTEIN_STEPS);

  const score = negative - positive;
  return { score, grade: gradeGeneral(score) };
}
