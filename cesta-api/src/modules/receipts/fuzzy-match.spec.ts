import { fuzzyMatchProduct, levenshtein, ratio } from './fuzzy-match';

describe('fuzzy-match', () => {
  describe('levenshtein', () => {
    it('returns 0 for identical strings', () => {
      expect(levenshtein('leche', 'leche')).toBe(0);
    });

    it('counts single-char substitution', () => {
      expect(levenshtein('leche', 'leche-')).toBe(1);
    });

    it('handles empty strings', () => {
      expect(levenshtein('', 'abc')).toBe(3);
      expect(levenshtein('abc', '')).toBe(3);
    });
  });

  describe('ratio', () => {
    it('returns 1 for identical strings', () => {
      expect(ratio('leche-entera-1l', 'leche-entera-1l')).toBe(1);
    });

    it('returns value between 0 and 1 for similar strings', () => {
      const r = ratio('leche-entera-1l', 'lecheentera-1l');
      expect(r).toBeGreaterThan(0.85);
      expect(r).toBeLessThan(1);
    });
  });

  describe('fuzzyMatchProduct', () => {
    const catalog = [
      { id: 'p1', normalizedName: 'leche-entera-1l' },
      { id: 'p2', normalizedName: 'pan-integral-500g' },
      { id: 'p3', normalizedName: 'arroz-largo-1kg' },
    ];

    it('returns product id on fuzzy match above threshold', () => {
      // OCR typo: "lch" vira "leche"
      const match = fuzzyMatchProduct('leche-entera-11', catalog, 0.7);
      expect(match).toBe('p1');
    });

    it('returns null when no candidate crosses threshold', () => {
      expect(fuzzyMatchProduct('xyzxyz', catalog, 0.7)).toBeNull();
    });

    it('picks best candidate when multiple above threshold', () => {
      const match = fuzzyMatchProduct('leche-entera-1k', catalog, 0.7);
      expect(match).toBe('p1');
    });
  });
});
