// Parser heurístico de nota fiscal espanhola.
// Formatos variam entre redes; o parser busca padrões comuns:
//  - cabeçalho com nome do mercado
//  - data no formato dd/mm/yyyy
//  - linhas de item: "<quantidade>? <nome> ... <preço>"
//  - rodapé com "TOTAL" + preço

const SUPERMARKET_KEYWORDS: Array<{ slug: string; patterns: RegExp[] }> = [
  { slug: 'mercadona', patterns: [/mercadona/i, /hacendado/i] },
  { slug: 'carrefour', patterns: [/carrefour/i] },
  { slug: 'alcampo', patterns: [/alcampo/i, /auchan/i] },
  { slug: 'lidl', patterns: [/\blidl\b/i] },
  { slug: 'froiz', patterns: [/froiz/i] },
  { slug: 'dia', patterns: [/\bdia %?\b/i, /\bdia\s*max\b/i, /super\s*dia/i] },
  { slug: 'aldi', patterns: [/\baldi\b/i] },
];

// Regex pra preço espanhol: "1,99" ou "1.99", opcional "€" / "EUR"
const PRICE_REGEX = /(\d{1,4}[.,]\d{2})\s*€?/;
const PRICE_END_REGEX = /(\d{1,4}[.,]\d{2})\s*€?\s*$/;
const DATE_REGEX = /(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})/;
const QTY_REGEX = /^(\d{1,3}(?:[.,]\d+)?)\s*(?:x|X|\*)\s/;
const TOTAL_LINE = /total\b.*?(\d{1,4}[.,]\d{2})/i;

export interface ParsedItem {
  rawText: string;
  normalizedName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  categoryHint: string | null;
}

export interface ParsedReceipt {
  supermarketSlug: string | null;
  purchaseDate: Date | null;
  total: number | null;
  items: ParsedItem[];
}

function toNumber(raw: string): number {
  return parseFloat(raw.replace(/\./g, '').replace(',', '.'));
}

function slugifyLine(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function detectSupermarket(text: string): string | null {
  const head = text.slice(0, Math.min(text.length, 500));
  for (const entry of SUPERMARKET_KEYWORDS) {
    if (entry.patterns.some((p) => p.test(head))) return entry.slug;
  }
  return null;
}

function detectDate(text: string): Date | null {
  const match = text.match(DATE_REGEX);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  let year = parseInt(match[3], 10);
  if (year < 100) year += 2000;
  if (
    day < 1 ||
    day > 31 ||
    month < 1 ||
    month > 12 ||
    year < 2015 ||
    year > 2100
  ) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function detectTotal(text: string): number | null {
  // Procura última ocorrência de "TOTAL ... preço"
  const lines = text.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const m = lines[i].match(TOTAL_LINE);
    if (m) return toNumber(m[1]);
  }
  return null;
}

function parseItemLine(rawLine: string): ParsedItem | null {
  const cleaned = rawLine.trim();
  if (cleaned.length < 4) return null;

  // Ignora linhas que claramente são totais/subtotais/impostos
  if (
    /subtotal|total|iva\b|efectivo|tarjeta|cambio|cnif|c\.i\.f|cif:|^gracias/i.test(
      cleaned,
    )
  ) {
    return null;
  }

  // Tenta extrair preço final da linha
  const priceMatch = cleaned.match(PRICE_END_REGEX);
  if (!priceMatch) return null;
  const total = toNumber(priceMatch[1]);
  if (!Number.isFinite(total) || total <= 0 || total > 9999) return null;

  // Remove o preço do fim pra pegar nome
  const nameRegion = cleaned
    .slice(0, cleaned.length - priceMatch[0].length)
    .trim();

  // Quantidade opcional no início ("2 x arroz", "0,5 kg")
  let quantity = 1;
  let name = nameRegion;
  const qtyMatch = nameRegion.match(QTY_REGEX);
  if (qtyMatch) {
    const q = toNumber(qtyMatch[1]);
    if (Number.isFinite(q) && q > 0 && q < 100) {
      quantity = q;
      name = nameRegion.slice(qtyMatch[0].length).trim();
    }
  }

  // Nome muito curto ou numérico → provavelmente ruído
  if (name.length < 3 || /^[\d\s.,]+$/.test(name)) return null;

  const unitPrice =
    quantity > 0 ? Math.round((total / quantity) * 100) / 100 : total;

  return {
    rawText: cleaned,
    normalizedName: slugifyLine(name),
    quantity,
    unitPrice,
    total,
    categoryHint: null,
  };
}

export function parseReceipt(rawText: string): ParsedReceipt {
  const supermarketSlug = detectSupermarket(rawText);
  const purchaseDate = detectDate(rawText);
  const total = detectTotal(rawText);

  const lines = rawText.split(/\r?\n/);
  const items: ParsedItem[] = [];
  for (const line of lines) {
    const parsed = parseItemLine(line);
    if (parsed) items.push(parsed);
  }

  return { supermarketSlug, purchaseDate, total, items };
}

// Exportado para testes/debug
export const __test__ = {
  parseItemLine,
  detectSupermarket,
  detectTotal,
  PRICE_REGEX,
};
