/**
 * Sprint 245 (ADR 0046) — "produto equivalente" piloto 5 categorias.
 *
 * Classifica produtos num typeKey brand-neutral + sizeCanon.
 * Agrupamento por (typeKey, sizeCanon, variantKey) + marcas DIFERENTES
 * forma um grupo equivalente cross-mercado cross-brand.
 *
 * typeKey definitions (regex sobre normalizeNameForMatch):
 *   leche-entera     → "leche entera" (ex: "Leche entera brik 1L")
 *   leche-semi       → "leche semidesnatada" ou "leche semi"
 *   leche-desnatada  → "leche desnatada" ou "leche sin lactosa"
 *   agua-mineral     → "agua mineral" ou "agua"
 *   huevos           → "huevos" + opcional categoria (M/L/XL)
 *   aceite-oliva     → "aceite oliva virgen extra" ou "aceite oliva"
 *   pan-molde        → "pan molde" ou "pan de molde"
 *   pan              → "pan" (fallback geral — sem molde/tostado/etc)
 *
 * Fora do piloto 5 categorias: null (produto NÃO entra em grupo equivalente).
 */

import { normalizeNameForMatch, extractVariants } from './brand-normalize.mjs';

// Patterns ordenados do mais específico pro mais geral (first-match wins).
// Rodam sobre o output de `normalizeNameForMatch`, que STRIP-a brand, size,
// acentos E genéricas (de/del/con/sin/la/el/los/las). Patterns precisam
// portanto se ajustar à forma pós-strip:
//   "Leche sin lactosa 1L"      → "leche lactosa"
//   "Agua sin gas Lanjarón 1L"  → "agua gas"
//   "Aceite de oliva virgen extra Carbonell 1L" → "aceite oliva virgen extra"
const TYPE_PATTERNS = [
  // Categoria 1: Leche (3 variantes principais)
  { typeKey: 'leche-entera', re: /\bleche\s+entera\b/, categoryHints: ['lacteos'] },
  { typeKey: 'leche-semi', re: /\bleche\s+(?:semidesnatada|semi)\b/, categoryHints: ['lacteos'] },
  { typeKey: 'leche-desnatada', re: /\bleche\s+(?:desnatada|lactosa)\b/, categoryHints: ['lacteos'] },

  // Categoria 2: Agua ("sin"/"con" strip-adas pelo normalize → "agua gas")
  { typeKey: 'agua-mineral', re: /\bagua\s+(?:mineral|gas)\b/, categoryHints: ['bebidas', 'aguas'] },

  // Categoria 3: Huevos
  { typeKey: 'huevos', re: /\bhuevos\b/, categoryHints: ['huevos', 'granja'] },

  // Categoria 4: Aceite oliva ("de" strip-ada: "aceite oliva virgen extra")
  { typeKey: 'aceite-oliva-ve', re: /\baceite\s+oliva\s+virgen\s+extra\b/, categoryHints: ['aceites'] },
  { typeKey: 'aceite-oliva', re: /\baceite\s+oliva\b/, categoryHints: ['aceites'] },

  // Categoria 5: Pan ("de" strip-ada: "pan molde")
  { typeKey: 'pan-molde', re: /\bpan\s+molde\b/, categoryHints: ['panaderia', 'pan'] },
];

/**
 * Mapeia produto → typeKey piloto, ou null se fora das 5 categorias.
 * Usa `normalizeNameForMatch` com brand=null (preserva nome tipo, remove
 * size/genéricas).
 */
export function classifyTypeKey(name, brand = null) {
  if (!name) return null;
  const norm = normalizeNameForMatch(name, brand);
  for (const { typeKey, re } of TYPE_PATTERNS) {
    if (re.test(norm)) return typeKey;
  }
  return null;
}

/**
 * Canonical string do tamanho pra agrupamento. `effectiveSize` já
 * retorna {value, unit, pack}; convertemos pra "VALOR+UNIT[xPACK]"
 * (ex: "1000ml", "500g×6").
 */
export function sizeCanon(size) {
  if (!size) return '';
  const pack = size.pack > 1 ? `×${size.pack}` : '';
  return `${size.value}${size.unit}${pack}`;
}

/**
 * Variant key: ordena set de variantes pra gerar chave estável.
 * Produtos equivalentes devem ter MESMO set de variantes (entera vs
 * semi vs desnatada separados pelos typeKey; mas ex: "huevos ecologicos"
 * vs "huevos" separa por variant).
 */
export function variantCanon(name) {
  const vs = extractVariants(name);
  return [...vs].sort().join(',');
}

/**
 * Chave composta de agrupamento: typeKey + sizeCanon + variantCanon.
 */
export function equivalentGroupKey(typeKey, size, name) {
  return `${typeKey}|${sizeCanon(size)}|${variantCanon(name)}`;
}
