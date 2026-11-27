/**
 * Sprint 234 G3 recall fix (ADR 0041).
 *
 * Helpers compartilhados pra match-cluster.mjs + specs. Resolve 3 causas
 * do recall ~0 observado prod (Boss diagnostic 2026-11-27 19:16Z):
 *  (a) brand NULL em Mercadona Hacendado + Froiz Milka → extractBrand
 *      via dicionário.
 *  (b) nome contém brand+size+genéricas → normalizeNameForMatch remove
 *      ruído antes do trigram.
 *  (c) parseSize não cobre multi-pack '12 x 330 ml', 'pack 6 x 1 L',
 *      '1,25 L' → parse expandido retorna {value, unit, pack}.
 */

// ────────────────────────────────────────────────────────────
// (a) Brand dictionary
// ────────────────────────────────────────────────────────────

/**
 * Catálogo de marcas conhecidas no mercado espanhol. Inclui marcas
 * próprias dos supermercados + marcas fabricante relevantes. Case-
 * insensitive match com word boundary `\b` e tolerância a separadores
 * `-` ou espaço (`Coca-Cola` ≡ `Coca Cola`).
 *
 * Ordem importa: marcas mais específicas/longas primeiro pra `Coca-Cola`
 * ganhar sobre `Cola`.
 */
export const KNOWN_BRANDS = [
  // Marcas próprias supermercado
  'Hacendado',
  'Dia Láctea',
  'Dia',
  'Milsani',
  'Carrefour',
  'Carrefour Bio',
  'Carrefour Classic',
  'Alcampo',
  'Auchan',
  'Aliada',
  'Produit',
  'Eroski',
  'Eroski Basic',
  'Eroski Selección',
  'Froiz',
  // Fabricantes Spain
  'Coca-Cola',
  'Pepsi',
  'Nestle',
  'Nestlé',
  'Danone',
  'Activia',
  'Oreo',
  'Milka',
  'Lindt',
  'Nocilla',
  'Nutella',
  'Pascual',
  'Puleva',
  'Central Lechera Asturiana',
  'Bimbo',
  'Mahou',
  'Heineken',
  'Estrella Galicia',
  'Estrella Damm',
  'San Miguel',
  'Font Vella',
  'Bezoya',
  'Lanjaron',
  'Lanjarón',
  'Kellogg',
  'Nesquik',
  'Colacao',
  'Cola Cao',
  'Carbonell',
  'Azucarera',
  'Aguinamar',
  'Trevijano',
  'Gullón',
  'Campofrio',
  'Campofrío',
  'ElPozo',
  'El Pozo',
  'Navidul',
  'Argal',
  'Oscar Mayer',
  'Hero',
  'Royal',
  'Dr. Oetker',
  'Knorr',
  'Hellmanns',
  "Hellmann's",
  'Heinz',
  'Tulipán',
  'Flora',
  'Ligeresa',
  'Solán de Cabras',
  'Lauki',
  'Kaiku',
  'Chocapic',
  'Cheerios',
  'Lay\'s',
  'Doritos',
  'Pringles',
  'Fairy',
  'Ariel',
  'Ariel Mountain Spring',
  'Dixan',
  'Flotante',
  'Mimosín',
  'Scottex',
  'Colhogar',
  'Pampers',
  'Dodot',
  'Johnson',
  'H&S',
  'Head & Shoulders',
  'Pantene',
  'Herbal Essences',
  'Garnier',
  'L\'Oréal',
  'Loreal',
  'Nivea',
  'Dove',
  'Rexona',
  'Axe',
  'Oral-B',
  'Colgate',
  'Signal',
];

// Precompute regex pra cada marca — cacheable.
const BRAND_PATTERNS = KNOWN_BRANDS
  .slice()
  .sort((a, b) => b.length - a.length) // long before short
  .map((brand) => ({
    brand,
    re: new RegExp(
      '\\b' + brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[-\s]+/g, '[-\\s]*') + '\\b',
      'i',
    ),
  }));

/**
 * Extrai marca do texto. Procura primeira ocorrência do dicionário
 * (case-insensitive · separador flexível). Retorna forma canônica do
 * dicionário (não raw match) pra normalização consistente.
 *
 * @param {string} text nome do produto (ou brand field se já existe).
 * @returns {string|null}
 */
export function extractBrand(text) {
  if (!text || typeof text !== 'string') return null;
  for (const { brand, re } of BRAND_PATTERNS) {
    if (re.test(text)) return brand;
  }
  return null;
}

// ────────────────────────────────────────────────────────────
// (c) Size parser — expandido pra multi-pack
// ────────────────────────────────────────────────────────────

/**
 * Normaliza size do nome num shape canônico pra comparar cross-mercado.
 *
 * Retorno: `{ value: number, unit: 'ml'|'g'|'un', pack: number }` ou null.
 *
 * - `value`/`unit`: tamanho por unidade individual (em ml líquido, g sólido,
 *   OR 'un' pra contagem sem peso declarado).
 * - `pack`: quantidade embalada. 1 pra item único; N pra multi-pack.
 *
 * Exemplos:
 *   `'2L'`                     → { value: 2000, unit: 'ml', pack: 1 }
 *   `'1,25 L'`                 → { value: 1250, unit: 'ml', pack: 1 }
 *   `'330ml'`                  → { value: 330,  unit: 'ml', pack: 1 }
 *   `'12 x 330 ml'`            → { value: 330,  unit: 'ml', pack: 12 }
 *   `'pack 6 x 1 L'`           → { value: 1000, unit: 'ml', pack: 6 }
 *   `'pack 6'`                 → { value: 1,    unit: 'un', pack: 6 }
 *   `'500g'`                   → { value: 500,  unit: 'g',  pack: 1 }
 *   `'1kg'`                    → { value: 1000, unit: 'g',  pack: 1 }
 *   `'500 gr'`                 → { value: 500,  unit: 'g',  pack: 1 }
 */
export function parseSize(text) {
  if (!text || typeof text !== 'string') return null;
  const s = text.toLowerCase();

  // (I) Multi-pack "N x VALUE UNIT" — tenta primeiro porque engolir single
  // size dentro de multi é erro comum.
  const multiMatch = s.match(
    /(?:pack\s*)?(\d+)\s*(?:x|×)\s*(\d+(?:[.,]\d+)?)\s*(l|ml|kg|g|gr)\b/i,
  );
  if (multiMatch) {
    const pack = parseInt(multiMatch[1], 10);
    const unitSize = parseFloat(multiMatch[2].replace(',', '.'));
    const unit = multiMatch[3].toLowerCase();
    if (Number.isFinite(pack) && pack > 0 && Number.isFinite(unitSize) && unitSize > 0) {
      const ml = /^(l|ml)$/.test(unit);
      const factor = unit === 'l' || unit === 'kg' ? 1000 : 1;
      return {
        value: Math.round(unitSize * factor),
        unit: ml ? 'ml' : 'g',
        pack,
      };
    }
  }

  // (II) Pack sem size unitário declarado: "pack 6", "x6", "6 un", "6 unidades"
  const packOnlyMatch = s.match(/(?:pack\s*|x\s*)(\d+)\b/) ||
    s.match(/\b(\d+)\s*(?:un|unid|unidades?)\b/);
  const packOnly = packOnlyMatch ? parseInt(packOnlyMatch[1], 10) : null;

  // (III) Size unitário ml
  const mlMatch = s.match(/(\d+(?:[.,]\d+)?)\s*ml\b/);
  if (mlMatch) {
    const v = parseFloat(mlMatch[1].replace(',', '.'));
    if (Number.isFinite(v) && v > 0) {
      return { value: Math.round(v), unit: 'ml', pack: packOnly ?? 1 };
    }
  }

  // (IV) Size unitário L (não ml) — aceita "1,25 L"
  const lMatch = s.match(/(\d+(?:[.,]\d+)?)\s*l\b(?!\w)/);
  if (lMatch && !/ml\b/.test(s)) {
    const v = parseFloat(lMatch[1].replace(',', '.'));
    if (Number.isFinite(v) && v > 0) {
      return { value: Math.round(v * 1000), unit: 'ml', pack: packOnly ?? 1 };
    }
  }

  // (V) kg
  const kgMatch = s.match(/(\d+(?:[.,]\d+)?)\s*kg\b/);
  if (kgMatch) {
    const v = parseFloat(kgMatch[1].replace(',', '.'));
    if (Number.isFinite(v) && v > 0) {
      return { value: Math.round(v * 1000), unit: 'g', pack: packOnly ?? 1 };
    }
  }

  // (VI) g/gr (não kg)
  const gMatch = s.match(/(\d+(?:[.,]\d+)?)\s*gr?\b/);
  if (gMatch && !/kg\b/.test(s)) {
    const v = parseFloat(gMatch[1].replace(',', '.'));
    if (Number.isFinite(v) && v > 0) {
      return { value: Math.round(v), unit: 'g', pack: packOnly ?? 1 };
    }
  }

  // (VII) Só pack (sem size unitário)
  if (packOnly && packOnly > 1) {
    return { value: 1, unit: 'un', pack: packOnly };
  }

  return null;
}

export function sizeMatch(a, b) {
  const sa = parseSize(a);
  const sb = parseSize(b);
  if (!sa || !sb) return false;
  return sa.unit === sb.unit && sa.value === sb.value && sa.pack === sb.pack;
}

/**
 * Sprint 234: alguns adapters (DIA) não incluem size no name — size vem
 * em `Product.packageSize` + `Product.packageUnit`. `sizeFromDb` constrói
 * o shape `{value, unit, pack}` canônico a partir desses campos.
 * `effectiveSize` prefere o size extraído do name (mais específico, cobre
 * multi-pack) e fallback pro DB.
 */
export function sizeFromDb(packageSize, packageUnit) {
  if (packageSize == null || !packageUnit) return null;
  const v = typeof packageSize === 'string' ? parseFloat(packageSize) : Number(packageSize);
  if (!Number.isFinite(v) || v <= 0) return null;
  const u = String(packageUnit).toUpperCase();
  switch (u) {
    case 'LITER':
      return { value: Math.round(v * 1000), unit: 'ml', pack: 1 };
    case 'MILLILITER':
      return { value: Math.round(v), unit: 'ml', pack: 1 };
    case 'KILOGRAM':
      return { value: Math.round(v * 1000), unit: 'g', pack: 1 };
    case 'GRAM':
      return { value: Math.round(v), unit: 'g', pack: 1 };
    case 'UNIT':
      // UNIT=1 is ambiguous (sem size real); só consideramos se N>1 (pack).
      return v > 1 ? { value: 1, unit: 'un', pack: Math.round(v) } : null;
    default:
      return null;
  }
}

export function effectiveSize(name, packageSize, packageUnit) {
  return parseSize(name) ?? sizeFromDb(packageSize, packageUnit);
}

export function sizeMatchEff(a, b) {
  const sa = effectiveSize(a.name, a.packageSize, a.packageUnit);
  const sb = effectiveSize(b.name, b.packageSize, b.packageUnit);
  if (!sa || !sb) return false;
  return sa.unit === sb.unit && sa.value === sb.value && sa.pack === sb.pack;
}

// ────────────────────────────────────────────────────────────
// (b) Name normalizer pra trigram
// ────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────
// (S235) Variant/flavor tokens
// ────────────────────────────────────────────────────────────

/**
 * Tokens de variante/sabor que, se presentes em um lado do par mas NÃO
 * no outro, significa produto distinto (Zero vs Original · Golden vs
 * regular · Horno vs tradicional). Gate variant exige igualdade EXATA
 * do set de tokens variante extraídos de cada lado.
 *
 * Normalizados: sem acento, lowercase, hyphen→espaço.
 */
export const VARIANT_TOKENS = [
  // Coca-Cola / Pepsi / refrigerantes — discriminantes principais.
  // NÃO incluir 'azucar'/'cafeina' stand-alone (filler que co-ocorre com
  // 'zero'/'sin cafeina' · causaria mismatch espúrio).
  // 'sin azucar' redundante com 'zero' · omitido pra evitar false mismatch.
  'zero', 'light', 'lite', 'original', 'classic', 'diet', 'max',
  'sin cafeina',
  'limon', 'naranja', 'cherry', 'lima',
  // Chocolate (Milka · Oreo · Lindt)
  'golden', 'avellana', 'avelana', 'almendra', 'amendoa', 'noisette',
  'blanco', 'negro', 'oscuro',
  'relleno', 'bombon',
  // Lay's / patatas fritas
  'horno', 'jamon', 'campesinas', 'barbacoa', 'cebolla',
  // Cerveza
  'rubia', 'tostada', 'negra', 'ipa', 'radler', 'sin alcohol',
  // Leche/yogur/dairy — discriminantes de tipo
  'entera', 'semidesnatada', 'desnatada', 'sin lactosa',
  'griego', 'fresa', 'vainilla',
  // Carne — cortes
  'picada', 'fileteada', 'lonchas', 'asado',
  // Papel/higiene
  'blanqueador', 'triple capa', 'doble capa',
];

// Pre-build regex pra cada token (word boundary · multi-word apóia · hyphen flex).
const VARIANT_PATTERNS = VARIANT_TOKENS
  .slice()
  .sort((a, b) => b.length - a.length) // multi-word primeiro
  .map((tok) => ({
    tok,
    re: new RegExp(
      '\\b' + tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[-\s]+/g, '[-\\s]*') + '\\b',
      'i',
    ),
  }));

/**
 * Extrai set de variantes do nome. Retorna Set<string> com tokens
 * canônicos do dicionário. Acentos removidos antes do match.
 */
export function extractVariants(text) {
  const out = new Set();
  if (!text || typeof text !== 'string') return out;
  const norm = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  for (const { tok, re } of VARIANT_PATTERNS) {
    if (re.test(norm)) out.add(tok);
  }
  return out;
}

/**
 * Compara sets de variantes. Pra match exato cross-mercado, o par
 * precisa ter EXATAMENTE o mesmo set (Zero == Zero · Light == Light ·
 * Original == Original). Zero vs Original → mismatch. Tanto diferença
 * quanto um-lado-só → NÃO match.
 */
export function variantMatch(a, b) {
  if (a.size !== b.size) return false;
  for (const t of a) if (!b.has(t)) return false;
  return true;
}

const GENERIC_WORDS = [
  'refresco',
  'bebida',
  'producto',
  'bandeja',
  'brik',
  'botella',
  'botellin',
  'lata',
  'bote',
  'bolsa',
  'paquete',
  'caja',
  'tarrina',
  'frasco',
  'envase',
  'de',
  'del',
  'con',
  'sin',
  'la',
  'el',
  'los',
  'las',
];

/**
 * Normaliza nome pra trigram similarity. Remove marca, size, genéricas,
 * acentos, pontuação. Retorna slug minúsculo com palavras substantivas.
 *
 * Exemplo:
 *   "Coca-Cola Zero Azucar Botella 2 L", brand="Coca-Cola"
 *     → "zero azucar"
 *
 *   "Leche entera Hacendado brik 1 L", brand="Hacendado"
 *     → "leche entera"
 */
export function normalizeNameForMatch(name, brand = null) {
  if (!name || typeof name !== 'string') return '';
  let n = name.toLowerCase();

  // Remove brand (se presente)
  const bEff = brand ?? extractBrand(name);
  if (bEff) {
    const re = new RegExp(
      '\\b' + bEff.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[-\s]+/g, '[-\\s]*') + '\\b',
      'ig',
    );
    n = n.replace(re, ' ');
  }

  // Remove size tokens (preciso ser estrito pra não comer "1l" inline).
  n = n.replace(/\d+(?:[.,]\d+)?\s*(?:x|×)\s*\d+(?:[.,]\d+)?\s*(?:ml|l|kg|g|gr|un|unidades?)\b/gi, ' ');
  n = n.replace(/\d+(?:[.,]\d+)?\s*(?:ml|l|kg|g|gr|un|unidades?)\b/gi, ' ');
  n = n.replace(/pack\s*\d+/gi, ' ');
  n = n.replace(/\b(?:x|×)\s*\d+\b/gi, ' ');

  // Remove acentos (NFD + strip diacritic combining marks)
  n = n.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Remove pontuação exceto espaço + hyphens (hyphens viram espaço).
  n = n.replace(/[.,;:!?/\\()\[\]"'`’_]/g, ' ');
  n = n.replace(/-+/g, ' ');

  // Remove genéricas
  for (const g of GENERIC_WORDS) {
    const re = new RegExp(`\\b${g}\\b`, 'gi');
    n = n.replace(re, ' ');
  }

  // Collapse spaces
  return n.replace(/\s+/g, ' ').trim();
}
