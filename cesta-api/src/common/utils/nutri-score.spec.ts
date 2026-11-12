import { calculateNutriScore } from './nutri-score';

describe('calculateNutriScore', () => {
  it('azeite oliva (884 kcal, 14g sat fat) → E', () => {
    const r = calculateNutriScore({
      calories: 884,
      sugar: 0,
      saturatedFat: 14,
      salt: 0,
      fiber: 0,
      protein: 0,
      nutritionPer: 100,
      comparisonUnit: 'LITER',
    });
    expect(r).not.toBeNull();
    expect(r!.grade).toBe('E');
  });

  it('alface (15 kcal, 2g fibra) → A', () => {
    const r = calculateNutriScore({
      calories: 15,
      sugar: 1,
      saturatedFat: 0,
      salt: 0.02,
      fiber: 2,
      protein: 1,
      nutritionPer: 100,
      comparisonUnit: 'KILOGRAM',
    });
    expect(r).not.toBeNull();
    expect(r!.grade).toBe('A');
  });

  it('refrigerante açucarado (42 kcal, 11g açúcar) → B ou C (FSA simplificado sem modificador bebida)', () => {
    const r = calculateNutriScore({
      calories: 42,
      sugar: 11,
      saturatedFat: 0,
      salt: 0,
      fiber: 0,
      protein: 0,
      nutritionPer: 100,
      comparisonUnit: 'LITER',
    });
    expect(r).not.toBeNull();
    expect(['B', 'C']).toContain(r!.grade);
  });

  it('peito frango (110 kcal, 23g proteína) → A ou B', () => {
    const r = calculateNutriScore({
      calories: 110,
      sugar: 0,
      saturatedFat: 1,
      salt: 0.1,
      fiber: 0,
      protein: 23,
      nutritionPer: 100,
      comparisonUnit: 'KILOGRAM',
    });
    expect(r).not.toBeNull();
    expect(['A', 'B']).toContain(r!.grade);
  });

  it('comparisonUnit UNIT → null (pack de ovos 12un)', () => {
    const r = calculateNutriScore({
      calories: 150,
      sugar: 1,
      saturatedFat: 3,
      salt: 0.3,
      fiber: 0,
      protein: 13,
      nutritionPer: 1,
      comparisonUnit: 'UNIT',
    });
    expect(r).toBeNull();
  });

  it('mais de 2 campos essenciais null → null', () => {
    const r = calculateNutriScore({
      calories: 200,
      sugar: null,
      saturatedFat: null,
      salt: null,
      fiber: null,
      protein: 5,
      nutritionPer: 100,
      comparisonUnit: 'KILOGRAM',
    });
    expect(r).toBeNull();
  });

  it('exatamente 2 campos null → calcula (trata null como 0)', () => {
    const r = calculateNutriScore({
      calories: 50,
      sugar: 2,
      saturatedFat: 0,
      salt: 0.05,
      fiber: null,
      protein: null,
      nutritionPer: 100,
      comparisonUnit: 'KILOGRAM',
    });
    expect(r).not.toBeNull();
  });

  it('manteiga (717 kcal, 51g sat fat) → E', () => {
    const r = calculateNutriScore({
      calories: 717,
      sugar: 0.1,
      saturatedFat: 51,
      salt: 1.5,
      fiber: 0,
      protein: 0.9,
      nutritionPer: 100,
      comparisonUnit: 'KILOGRAM',
    });
    expect(r).not.toBeNull();
    expect(r!.grade).toBe('E');
  });
});
