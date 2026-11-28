/**
 * Sprint 245b (ADR 0047 · refina ADR 0046) — classifier refinado após
 * dry-run S245 marcar 41% de erro (23/56 grupos) vs limite Boss 5%.
 *
 * Principais correções:
 *   (1) Azeite: HEAD NOUN check — nome deve COMEÇAR com "aceite" (não
 *       "melva en aceite de oliva" / "atún en aceite de oliva" que caíam
 *       como aceite-oliva). Grau separado em typeKeys distintos
 *       (virgen-extra, virgen, oliva-refinado, oliva-suave, oliva-intenso).
 *       Aromatizados (trufa/ajo/guindilla/limón) FORA.
 *   (2) Água: "con gas"/"con sabor"/"vitaminada" separam typeKey OU
 *       saem fora. Sem size parseável → FORA. Nunca inferir size.
 *   (3) Leite: FORA bebida-lactea/batido/cabra/oveja/arroz/soja/coco/
 *       almendra/avena. Enriquecido (calcio/omega-3/proteinas/fibra/
 *       vitaminas) separa variante.
 *   (4) Ovos: chave composta classe (S/M/L/XL) + quantidade + cría
 *       (suelo/camperos/ecologicos/jaula).
 *   (5) Pão molde: variante OBRIGATÓRIA (blanco/integral/especial).
 *       Sem variante → FORA.
 *   (6) Size: use Product.packageSize + packageUnit como fonte autoritativa
 *       (`sizeFromDb`). Name parse só fallback quando DB vazio. Null → FORA.
 *
 * typeKey enum (piloto S245b expandido):
 *   leche-entera, leche-semi, leche-desnatada
 *   agua-mineral-plana  (gas/vitaminada/sabor fora)
 *   huevos  (chave inclui grade + cría no variantKey)
 *   aceite-oliva-ve     (virgen extra)
 *   aceite-oliva-virgen (virgen · sem extra)
 *   aceite-oliva-refinado (suave/intenso/refinado — grau único)
 *   pan-molde  (variante blanco|integral|especial obrigatória)
 */

import { extractVariants, sizeFromDb, parseSize, extractBrand } from './brand-normalize.mjs';

// ────────────────────────────────────────────────────────────
// Helper: lightweight normalize (SEM strip de genéricas) — mantém
// "con", "sin", "en", "de" pra os guards rodarem contra o nome real.
// ────────────────────────────────────────────────────────────

function lightNormalize(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[.,;:!?/\\()\[\]"'`’_®™]/g, ' ')
    .replace(/-+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Remove brand do nome normalizado leve pra os head-noun checks baterem
 * sem a interferência da marca (ex: "La masía" tem "aceite" no nome
 * da marca? Não neste caso, mas defesa).
 */
function stripBrandLight(norm, brand) {
  if (!brand) return norm;
  const escaped = brand
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/[-\s]+/g, '[-\\s]+');
  return norm.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ────────────────────────────────────────────────────────────
// Classifiers por categoria — cada um retorna typeKey OU null.
// Head-noun check: nome deve COMEÇAR com o head noun pra evitar
// false positives tipo "melva EN aceite de oliva".
// ────────────────────────────────────────────────────────────

const ACEITE_AROMATIZADO_OUT = /\b(trufa|ajo|guindilla|limon|romero|albahaca|aromatizad[oa]|infusionad)\b/;

function classifyAceite(norm) {
  // Head noun: name DEVE começar com "aceite".
  if (!/^aceite\b/.test(norm)) return null;
  // Deve conter "oliva" (fora: aceite girasol, aceite semilla, aceite soja etc).
  if (!/\boliva\b/.test(norm)) return null;
  // Aromatizados FORA.
  if (ACEITE_AROMATIZADO_OUT.test(norm)) return null;
  // Grau — ordem importa (virgen extra antes de virgen).
  if (/\bvirgen\s+extra\b/.test(norm)) return 'aceite-oliva-ve';
  if (/\bvirgen\b/.test(norm)) return 'aceite-oliva-virgen';
  // Suave/intenso/refinado = mesmo typeKey "refinado" (grau único · variant
  // key fica em variantKey pra distinguir dentro).
  if (/\b(suave|intenso|refinado)\b/.test(norm)) return 'aceite-oliva-refinado';
  return null;
}

const AGUA_OUT = /\b(gas|gasificad|vitaminad|sabor|alcalin|infusionad|aromatizad|carbonat)\b/;

function classifyAgua(norm) {
  // Head noun check — "agua" no começo.
  if (!/^agua\b/.test(norm)) return null;
  // Excluir qualquer variação não-plana. "con gas"/"sin gas" são distintos
  // mas o Boss decidiu que gas e similar ficam FORA do piloto por enquanto.
  if (AGUA_OUT.test(norm)) return null;
  // Aceita "mineral" explícito OR "agua" solo.
  if (/\bmineral\b/.test(norm) || /^agua\b\s+\d/.test(norm) || /^agua\b\s*$/.test(norm)) {
    return 'agua-mineral-plana';
  }
  // Agua + palavra relevante do catálogo (fuente/manantial) também plana.
  if (/\b(fuente|manantial|natural)\b/.test(norm)) return 'agua-mineral-plana';
  return 'agua-mineral-plana'; // default plana se head noun casa
}

const LECHE_OUT = /\b(bebida|batido|cabra|oveja|arroz|soja|coco|almendra|avena|espelta|cereales|chocolate|vainilla|fresa|cafe)\b/;

function classifyLeche(norm) {
  // Head noun check — "leche" no começo.
  if (!/^leche\b/.test(norm)) return null;
  // Excluir bebidas láctea, batidos, leites não vacunos, saborizados.
  if (LECHE_OUT.test(norm)) return null;
  if (/\bentera\b/.test(norm)) return 'leche-entera';
  if (/\b(semidesnatada|semi)\b/.test(norm)) return 'leche-semi';
  if (/\b(desnatada|sin\s+lactosa)\b/.test(norm)) return 'leche-desnatada';
  return null;
}

function classifyHuevos(norm) {
  // Head noun check — "huevos" no começo.
  if (!/^huevos\b/.test(norm)) return null;
  // Codorniz/pato/chocolate FORA.
  if (/\b(codorniz|pato|chocolate)\b/.test(norm)) return null;
  return 'huevos';
}

const PAN_VARIANT_REQUIRED = /\b(blanco|integral|cereales|espelta|avena|maiz|proteinas|centeno|espigas|multicereal)\b/;

function classifyPan(norm) {
  // Head noun check — "pan" no começo + requer "molde" explícito.
  if (!/^pan\b/.test(norm)) return null;
  if (!/\bmolde\b/.test(norm)) return null;
  // Tostadas/rallado/precocido FORA.
  if (/\b(tostadas|rallado|precocido|fresco|hamburguesa|hot\s+dog|perrito)\b/.test(norm)) return null;
  // Variante obrigatória — sem blanco/integral/especial, fora do piloto.
  if (!PAN_VARIANT_REQUIRED.test(norm)) return null;
  return 'pan-molde';
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

/**
 * Mapeia produto → typeKey piloto, ou null se fora das 5 categorias.
 * Roda sobre nome original (post-brand-strip + accent-strip + lowercase),
 * preservando "sin", "con", "de", "en" — os classifiers dependem desses
 * tokens pra discriminar (ex: "con gas" fora, "en aceite" head-noun fail).
 */
export function classifyTypeKey(name, brand = null) {
  if (!name) return null;
  const effBrand = brand ?? extractBrand(name);
  const norm = stripBrandLight(lightNormalize(name), effBrand);
  return (
    classifyLeche(norm) ??
    classifyAgua(norm) ??
    classifyHuevos(norm) ??
    classifyAceite(norm) ??
    classifyPan(norm)
  );
}

/**
 * Size canonical — Sprint 245b (rule 6 Boss): usa `Product.packageSize` +
 * `packageUnit` como fonte autoritativa (sizeFromDb). Nome só fallback
 * quando DB vazio. Null → caller descarta produto do piloto.
 */
export function canonicalSize(name, packageSize, packageUnit) {
  const fromDb = sizeFromDb(packageSize, packageUnit);
  if (fromDb) return fromDb;
  return parseSize(name);
}

/**
 * Canonical string do tamanho pra agrupamento.
 */
export function sizeCanon(size) {
  if (!size) return '';
  const pack = size.pack > 1 ? `×${size.pack}` : '';
  return `${size.value}${size.unit}${pack}`;
}

/**
 * Variant key — Sprint 245b: além do extractVariants genérico (S235),
 * incluí tokens enriquecimento/grade/cría específicos do piloto pra
 * discriminar dentro do mesmo typeKey.
 */
const PILOT_VARIANT_PATTERNS = {
  // Leche enriquecida — tokens aparecem no nome original (não normalize).
  enriq_calcio: /\bcalcio\b/i,
  enriq_omega: /\bomega(\s*-?\s*3)?\b/i,
  enriq_proteinas: /\bproteinas?\b/i,
  enriq_fibra: /\bfibra\b/i,
  enriq_vitaminas: /\bvitaminas?\b/i,
  // Ovos — classe + cría.
  huevo_xl: /\bxl\b/i,
  huevo_l: /(?:^|\s)l(?:\s|,|$)|\bgrande(?!s)\b|\bgrandes\b/i,
  huevo_m: /(?:^|\s)m(?:\s|,|$)|\bmediano\b|\bmedianos\b/i,
  huevo_s: /(?:^|\s)s(?:\s|,|$)|\bpequeno\b/i,
  huevo_camperos: /\bcamperos?\b/i,
  huevo_ecologicos: /\becologico/i,
  huevo_suelo: /\bsuelo\b/i,
  huevo_jaula: /\bjaula\b/i,
  huevo_qty_6: /\b6\s*(?:un|unidades?)\b/i,
  huevo_qty_12: /\b12\s*(?:un|unidades?)\b/i,
  huevo_qty_30: /\b30\s*(?:un|unidades?)\b/i,
  // Pão molde
  pan_blanco: /\bblanco\b/i,
  pan_integral: /\bintegral\b/i,
  pan_cereales: /\b(?:cereales|multicereal|centeno|espelta|avena|maiz|espigas)\b/i,
  pan_proteinas: /\bproteinas?\b/i,
  // Aceite grau detalhe (dentro do refinado).
  aceite_suave: /\bsuave\b/i,
  aceite_intenso: /\bintenso\b/i,
};

export function variantCanon(name) {
  const tokens = new Set();
  // Tokens genéricos S235 (zero/golden/horno/men/mujer/etc.)
  for (const t of extractVariants(name)) tokens.add(t);
  // Tokens S245b piloto-específicos.
  if (name) {
    for (const [key, re] of Object.entries(PILOT_VARIANT_PATTERNS)) {
      if (re.test(name)) tokens.add(key);
    }
  }
  return [...tokens].sort().join(',');
}

/**
 * Chave composta de agrupamento: typeKey + sizeCanon + variantCanon.
 */
export function equivalentGroupKey(typeKey, size, name) {
  return `${typeKey}|${sizeCanon(size)}|${variantCanon(name)}`;
}
