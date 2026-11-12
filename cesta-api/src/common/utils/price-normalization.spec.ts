import { MeasureUnit } from '@prisma/client';
import { calculateUnitPrice } from './price-normalization';

describe('calculateUnitPrice', () => {
  it('normaliza aceite 0.75L → €/L', () => {
    const { value, unit } = calculateUnitPrice(
      3.15,
      0.75,
      MeasureUnit.LITER,
      MeasureUnit.LITER,
    );
    expect(unit).toBe('L');
    expect(value).toBeCloseTo(4.2, 4);
  });

  it('normaliza arroz 500g (0.5 kg) → €/kg', () => {
    const { value, unit } = calculateUnitPrice(
      1.2,
      0.5,
      MeasureUnit.KILOGRAM,
      MeasureUnit.KILOGRAM,
    );
    expect(unit).toBe('kg');
    expect(value).toBeCloseTo(2.4, 4);
  });

  it('normaliza refri 1500ml → €/L', () => {
    const { value, unit } = calculateUnitPrice(
      1.8,
      1500,
      MeasureUnit.MILLILITER,
      MeasureUnit.LITER,
    );
    expect(unit).toBe('L');
    expect(value).toBeCloseTo(1.2, 4);
  });

  it('normaliza pack ovos 12un → €/un', () => {
    const { value, unit } = calculateUnitPrice(
      2.4,
      12,
      MeasureUnit.UNIT,
      MeasureUnit.UNIT,
    );
    expect(unit).toBe('un');
    expect(value).toBeCloseTo(0.2, 4);
  });

  it('normaliza água 1.5L → €/L', () => {
    const { value, unit } = calculateUnitPrice(
      0.6,
      1.5,
      MeasureUnit.LITER,
      MeasureUnit.LITER,
    );
    expect(unit).toBe('L');
    expect(value).toBeCloseTo(0.4, 4);
  });

  it('normaliza iogurte 200g em €/100g', () => {
    const { value, unit } = calculateUnitPrice(
      0.8,
      200,
      MeasureUnit.GRAM,
      MeasureUnit.GRAM,
    );
    expect(unit).toBe('100g');
    expect(value).toBeCloseTo(0.4, 4);
  });

  it('rejeita combinação incompatível GRAM → LITER', () => {
    expect(() =>
      calculateUnitPrice(1, 500, MeasureUnit.GRAM, MeasureUnit.LITER),
    ).toThrow(/incompatible units/);
  });

  it('rejeita preço zero ou negativo', () => {
    expect(() =>
      calculateUnitPrice(0, 1, MeasureUnit.LITER, MeasureUnit.LITER),
    ).toThrow(/must be positive/);
    expect(() =>
      calculateUnitPrice(-1, 1, MeasureUnit.LITER, MeasureUnit.LITER),
    ).toThrow(/must be positive/);
  });

  it('rejeita packageSize zero', () => {
    expect(() =>
      calculateUnitPrice(1, 0, MeasureUnit.LITER, MeasureUnit.LITER),
    ).toThrow(/must be positive/);
  });
});
