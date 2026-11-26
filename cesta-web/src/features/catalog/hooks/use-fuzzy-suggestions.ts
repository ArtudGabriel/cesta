"use client";

import { useMemo } from "react";
import Fuse from "fuse.js";
import { useSuggestions } from "./use-suggestions";
import type { Suggestion } from "../services/catalog.service";

/**
 * Sprint 179 — wrapper client-side Fuse.js sobre /products/suggest.
 *
 * Grounding cesta.md §3.1 Catálogo "buscar produtos por nome genérico".
 * Backend endpoint usa `contains` + `mode: 'insensitive'` (exact substring).
 * Fuse adiciona (a) ranking por aproximidade quando backend retorna múltiplos
 * matches próximos mas não exatos, e (b) tolerância a transposição / typos
 * leves dentro do subset retornado (quando user corrige typo intermediário
 * com Backspace, histórico de dataset local permanece ranqueado).
 *
 * Opção A ADR-equivalente do scope S179: zero backend touch, Fuse só re-sort
 * + score sobre o array já fetched. Opções B/C (Postgres pg_trgm, LIKE expand)
 * exigiriam migration + extension; deferidas pós-MVP.
 */

const FUSE_OPTS: ConstructorParameters<typeof Fuse<Suggestion>>[1] = {
  keys: [
    { name: "name", weight: 0.7 },
    { name: "brand", weight: 0.3 },
  ],
  threshold: 0.4, // 0 = exato, 1 = qualquer coisa. 0.4 aceita ~1 typo
  ignoreLocation: true,
  minMatchCharLength: 2,
  includeScore: true,
};

export function useFuzzySuggestions(q: string, limit = 8) {
  const query = useSuggestions(q, limit);
  const trimmed = q.trim();

  const data = useMemo(() => {
    if (!query.data || trimmed.length < 2) return query.data;
    // Fuse re-ranks + score sort. Sem exact matches no backend, nada a adicionar
    // (post-fetch filter only). Caso base: backend retornou 5 suggestions; Fuse
    // reordena por score ASC (lower = better match).
    const fuse = new Fuse<Suggestion>(query.data, FUSE_OPTS);
    const ranked = fuse.search(trimmed);
    if (ranked.length === 0) {
      // Fuse threshold cortou tudo (typo severo); mantém dados backend originais
      // pra não deixar dropdown vazio quando user tipou substring parcial válida.
      return query.data;
    }
    return ranked.map((r) => r.item);
  }, [query.data, trimmed]);

  return { ...query, data };
}
