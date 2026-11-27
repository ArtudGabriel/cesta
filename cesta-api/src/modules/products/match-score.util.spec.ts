import {
  NO_PHRASE_MATCH_TIER,
  normalizeForMatch,
  scorePhraseMatch,
} from './match-score.util';

describe('normalizeForMatch', () => {
  it('lowercases e remove diacritics', () => {
    expect(normalizeForMatch('Leche Entera BRIK')).toBe('leche entera brik');
    expect(normalizeForMatch('Azúcar Moreno')).toBe('azucar moreno');
    expect(normalizeForMatch('Café Natural')).toBe('cafe natural');
  });

  it('normaliza separadores (hyphen/dot/slash/comma) em espaço', () => {
    expect(normalizeForMatch('Coca-Cola Zero 2L')).toBe('coca cola zero 2l');
    expect(normalizeForMatch('Refresco 1.5L')).toBe('refresco 1 5l');
    expect(normalizeForMatch('Jamón/Queso')).toBe('jamon queso');
  });

  it('colapsa whitespace múltiplo', () => {
    expect(normalizeForMatch('  Leche   Entera  ')).toBe('leche entera');
  });

  it('string vazia retorna string vazia', () => {
    expect(normalizeForMatch('')).toBe('');
    expect(normalizeForMatch('   ')).toBe('');
  });
});

describe('scorePhraseMatch', () => {
  it('tier 0: name começa com frase exata (leche entera)', () => {
    const score = scorePhraseMatch({
      name: 'Leche entera brik 1L Hacendado',
      query: 'leche entera',
    });
    expect(score.tier).toBe(0);
  });

  it('tier 0: phrase start normalizando hyphen (coca cola zero → Coca-Cola Zero)', () => {
    const score = scorePhraseMatch({
      name: 'Coca-Cola Zero 2L',
      query: 'coca cola zero',
    });
    expect(score.tier).toBe(0);
  });

  it('tier 0: phrase start com diacritics (azucar moreno → Azúcar Moreno)', () => {
    const score = scorePhraseMatch({
      name: 'Azúcar Moreno 1kg',
      query: 'azucar moreno',
    });
    expect(score.tier).toBe(0);
  });

  it('tier 1: phrase match em posição interna', () => {
    const score = scorePhraseMatch({
      name: 'Pack 6x Leche entera brik 1L',
      query: 'leche entera',
    });
    expect(score.tier).toBe(1);
  });

  it('tier 2: brand começa com frase (Oreo em brand sem name match)', () => {
    const score = scorePhraseMatch({
      name: 'Galletas Chocolate Original',
      brand: 'Oreo Family',
      query: 'oreo',
    });
    expect(score.tier).toBe(2);
  });

  it('tier 3: brand contém frase no meio', () => {
    const score = scorePhraseMatch({
      name: 'Galletas Chocolate',
      brand: 'Nabisco Oreo Variedad',
      query: 'oreo',
    });
    expect(score.tier).toBe(3);
  });

  it('tier 4: só tokens AND match (sem phrase substring)', () => {
    const score = scorePhraseMatch({
      name: 'Chocolate con leche almendras enteras',
      query: 'leche entera',
    });
    expect(score.tier).toBe(NO_PHRASE_MATCH_TIER);
  });

  it('priority: Leche entera brik tier 0 ganha de Chocolate con leche almendras enteras tier 4', () => {
    const correct = scorePhraseMatch({
      name: 'Leche entera brik 1L Hacendado',
      query: 'leche entera',
    });
    const wrong = scorePhraseMatch({
      name: 'Chocolate con leche almendras enteras',
      query: 'leche entera',
    });
    expect(correct.combined).toBeLessThan(wrong.combined);
  });

  it('category match empurra pra cima dentro do mesmo tier', () => {
    const withCat = scorePhraseMatch({
      name: 'Hacendado Natural',
      brand: 'Hacendado',
      categoryName: 'Lácteos',
      query: 'lacteos',
    });
    const withoutCat = scorePhraseMatch({
      name: 'Hacendado Natural',
      brand: 'Hacendado',
      categoryName: null,
      query: 'lacteos',
    });
    expect(withCat.combined).toBeLessThan(withoutCat.combined);
    expect(withCat.tier).toBe(NO_PHRASE_MATCH_TIER);
    expect(withCat.categoryMatch).toBe(true);
  });

  it('query vazia retorna tier 4 sem crash', () => {
    const score = scorePhraseMatch({ name: 'anything', query: '' });
    expect(score.tier).toBe(NO_PHRASE_MATCH_TIER);
  });

  it('tier 0 ganha de tier 1 ganha de tier 2 ganha de tier 3', () => {
    const q = 'oreo';
    const t0 = scorePhraseMatch({ name: 'Oreo Original', query: q });
    const t1 = scorePhraseMatch({ name: 'Galletas Oreo 100g', query: q });
    const t2 = scorePhraseMatch({
      name: 'Galletas Chocolate',
      brand: 'Oreo Family',
      query: q,
    });
    const t3 = scorePhraseMatch({
      name: 'Galletas Chocolate',
      brand: 'Nabisco Oreo Variedad',
      query: q,
    });
    expect(t0.tier).toBe(0);
    expect(t1.tier).toBe(1);
    expect(t2.tier).toBe(2);
    expect(t3.tier).toBe(3);
    expect(t0.combined).toBeLessThan(t1.combined);
    expect(t1.combined).toBeLessThan(t2.combined);
    expect(t2.combined).toBeLessThan(t3.combined);
  });
});
