"use client";

import { useSuggestions } from "./use-suggestions";

/**
 * Sprint 179 — wrapper client-side Fuse.js sobre /products/suggest.
 * Sprint 237 — Fuse re-rank removido. Backend `findSuggestions` agora
 * aplica tiers determinísticos (name-start > name-middle > brand-start >
 * brand-middle > tokens-only AND) + preço ASC como tiebreak
 * (match-score.util.ts). Fuse borrava a ordem na busca 'leche entera':
 * "Chocolate con leche almendras enteras" (fuzzy score alto, tokens
 * ricos) subia acima de "Leche entera brik 1L" (phrase exata).
 *
 * Tolerância a typo continua via backend pg_trgm fallback no mesmo repo
 * (word_similarity + boosts prefixais, vide products.repository.ts), que
 * só dispara quando ILIKE retorna zero. Hook agora é thin pass-through
 * pra manter contrato dos callers.
 */

export function useFuzzySuggestions(q: string, limit = 8) {
  return useSuggestions(q, limit);
}
