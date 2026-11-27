// Sprint 237: scoring tiers deterministic para ranking de busca por relevância
// antes de preço. Substitui ordenação só-por-preço que fazia 'leche entera'
// retornar 'Chocolate con leche almendras enteras' (mais barato) antes de
// 'Leche entera brik 1L Hacendado' (exact phrase match).
//
// Ordem de prioridade (tier menor ganha):
//   0  name começa com a frase exata (phrase start)
//   1  name contém a frase exata em qualquer posição
//   2  brand começa com a frase exata
//   3  brand contém a frase exata
//   4  nenhuma phrase match (apenas tokens AND via WHERE clause)
//
// Secondary: categoryMatch (-1 dentro do mesmo tier quando category name
// contém a frase normalizada).
// Tertiary: preço ASC (aplicado pelo caller com Array.sort tiebreak).

const DIACRITICS = /[̀-ͯ]/g;
// Separadores comuns em nomes de produtos espanhóis (Coca-Cola, 1.5L, 1·5L,
// slash-split em packs). Barra dupla aceita \\ só pra nunca confundir regex;
// na prática o catálogo não tem backslash.
const SEPARATORS = /[-_·.,;:/\\]+/g;

export function normalizeForMatch(input: string): string {
  return input
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(SEPARATORS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const NO_PHRASE_MATCH_TIER = 4;
const CATEGORY_MATCH_BONUS = 1;
const TIER_WEIGHT = 10;

export interface PhraseScoreInput {
  name: string;
  brand?: string | null;
  categoryName?: string | null;
  query: string;
}

export interface PhraseScore {
  tier: number;
  categoryMatch: boolean;
  combined: number;
}

/**
 * Calcula score composto `tier*TIER_WEIGHT + (categoryMatch ? 0 : 1)`.
 * Menor valor = mais relevante. Usar como primary sort key; tiebreak por
 * preço asc fica a cargo do caller.
 */
export function scorePhraseMatch(input: PhraseScoreInput): PhraseScore {
  const q = normalizeForMatch(input.query);
  if (!q) {
    return {
      tier: NO_PHRASE_MATCH_TIER,
      categoryMatch: false,
      combined: NO_PHRASE_MATCH_TIER * TIER_WEIGHT + CATEGORY_MATCH_BONUS,
    };
  }
  const name = normalizeForMatch(input.name);
  const brand = input.brand ? normalizeForMatch(input.brand) : '';
  const categoryName = input.categoryName
    ? normalizeForMatch(input.categoryName)
    : '';

  let tier = NO_PHRASE_MATCH_TIER;
  if (name.startsWith(q)) tier = 0;
  else if (name.includes(q)) tier = 1;
  else if (brand && brand.startsWith(q)) tier = 2;
  else if (brand && brand.includes(q)) tier = 3;

  const categoryMatch = categoryName.length > 0 && categoryName.includes(q);
  const combined =
    tier * TIER_WEIGHT + (categoryMatch ? 0 : CATEGORY_MATCH_BONUS);

  return { tier, categoryMatch, combined };
}
