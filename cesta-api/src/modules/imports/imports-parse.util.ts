import JSZip from 'jszip';

// CSV parser inline. Formato é o produzido por users-export.util.ts
// (RFC 4180-ish: UTF-8 BOM, CRLF separator, double-quote escape).
// Sem dep externa (pure TS ~40 linhas).

const BOM_RE = /^﻿/;

export function parseCsv(text: string): string[][] {
  const cleaned = text.replace(BOM_RE, '');
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (inQuotes) {
      if (c === '"') {
        if (cleaned[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (c === '\r') continue;
    if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // remove trailing blank row vindo de CRLF final
  while (rows.length > 0 && rows[rows.length - 1].every((f) => f === '')) {
    rows.pop();
  }
  return rows;
}

export interface ParsedCsvTable<T> {
  rows: T[];
  errors: Array<{ line: number; message: string }>;
}

/**
 * Converte table CSV num array de objetos tipados usando `mapper`.
 * `mapper` recebe row bruta (string[]) + header index map + número da linha
 * (2-based; 1 é header). Retorna null se linha é inválida, mandando message
 * pra errors.
 */
export function mapCsvRows<T>(
  table: string[][],
  requiredHeaders: string[],
  mapper: (
    row: string[],
    idx: Record<string, number>,
    line: number,
  ) => T | { error: string },
): ParsedCsvTable<T> {
  if (table.length === 0) {
    return { rows: [], errors: [{ line: 1, message: 'CSV vazio' }] };
  }
  const header = table[0];
  const idx: Record<string, number> = {};
  header.forEach((h, i) => {
    idx[h] = i;
  });
  for (const required of requiredHeaders) {
    if (!(required in idx)) {
      return {
        rows: [],
        errors: [
          { line: 1, message: `Header obrigatório ausente: ${required}` },
        ],
      };
    }
  }
  const rows: T[] = [];
  const errors: Array<{ line: number; message: string }> = [];
  for (let i = 1; i < table.length; i++) {
    const line = i + 1;
    const mapped = mapper(table[i], idx, line);
    if (mapped && typeof mapped === 'object' && 'error' in mapped) {
      errors.push({ line, message: mapped.error });
      continue;
    }
    rows.push(mapped as T);
  }
  return { rows, errors };
}

export interface FavoritoRow {
  productId: string;
}
export interface ListaRow {
  listId: string;
  listName: string;
  productId: string;
  quantity: number | null;
  position: number | null;
}
export interface AlertaRow {
  productId: string;
  type: string;
  targetPrice: number | null;
  isActive: boolean;
}
export interface ReviewRow {
  productId: string;
  rating: number;
  comment: string | null;
}
export interface ExpenseRow {
  receiptId: string;
  supermarketSlug: string | null;
  purchaseDate: Date | null;
  receiptTotal: number | null;
  itemName: string | null;
  itemRawText: string | null;
  quantity: number | null;
  unitPrice: number | null;
  itemTotal: number | null;
}

export interface ParsedZip {
  favoritos: ParsedCsvTable<FavoritoRow>;
  listas: ParsedCsvTable<ListaRow>;
  alertas: ParsedCsvTable<AlertaRow>;
  reviews: ParsedCsvTable<ReviewRow>;
  expenses: ParsedCsvTable<ExpenseRow>;
}

function toStr(v: string | undefined): string {
  return (v ?? '').trim();
}

function toNum(v: string | undefined): number | null {
  const s = toStr(v);
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toBool(v: string | undefined): boolean {
  return toStr(v).toLowerCase() === 'true';
}

function toInt(v: string | undefined): number | null {
  const n = toNum(v);
  return n === null ? null : Math.trunc(n);
}

function toDate(v: string | undefined): Date | null {
  const s = toStr(v);
  if (s === '') return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

const CUID_RE = /^c[a-z0-9]{24,}$/i;
function isCuid(s: string): boolean {
  return CUID_RE.test(s);
}

export async function parseImportZip(buffer: Buffer): Promise<ParsedZip> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`MALFORMED_ZIP: ${msg}`);
  }

  async function read(name: string): Promise<string> {
    const file = zip.file(name);
    if (!file) throw new Error(`MISSING_FILE: ${name}`);
    return file.async('string');
  }

  const favTxt = await read('favoritos.csv');
  const lstTxt = await read('listas.csv');
  const alrTxt = await read('alertas.csv');
  const revTxt = await read('reviews.csv');
  const expTxt = await read('expenses.csv');

  const favoritos = mapCsvRows<FavoritoRow>(
    parseCsv(favTxt),
    ['productId'],
    (row, idx) => {
      const productId = toStr(row[idx.productId]);
      if (!productId) return { error: 'productId vazio' };
      if (!isCuid(productId)) return { error: 'productId não é cuid' };
      return { productId };
    },
  );

  const listas = mapCsvRows<ListaRow>(
    parseCsv(lstTxt),
    ['listId', 'listName', 'productId'],
    (row, idx) => {
      const listName = toStr(row[idx.listName]);
      if (!listName) return { error: 'listName vazio' };
      if (listName.length > 120) return { error: 'listName > 120 chars' };
      const productId = toStr(row[idx.productId]);
      // listas.csv emite linha com productId vazio quando lista está vazia;
      // nesses casos cria lista sem items. Linha com productId preenchido
      // exige cuid válido.
      if (productId !== '' && !isCuid(productId)) {
        return { error: 'productId não é cuid' };
      }
      return {
        listId: toStr(row[idx.listId]),
        listName,
        productId,
        quantity: toNum(row[idx.quantity]),
        position: toInt(row[idx.position]),
      };
    },
  );

  const alertas = mapCsvRows<AlertaRow>(
    parseCsv(alrTxt),
    ['productId', 'type'],
    (row, idx) => {
      const productId = toStr(row[idx.productId]);
      if (!isCuid(productId)) return { error: 'productId não é cuid' };
      const type = toStr(row[idx.type]);
      const validTypes = [
        'promotion',
        'target_price',
        'promotion_ending',
        'back_in_stock',
      ];
      if (!validTypes.includes(type)) {
        return { error: `type inválido: ${type}` };
      }
      return {
        productId,
        type,
        targetPrice: toNum(row[idx.targetPrice]),
        isActive: toBool(row[idx.isActive]),
      };
    },
  );

  const reviews = mapCsvRows<ReviewRow>(
    parseCsv(revTxt),
    ['productId', 'rating'],
    (row, idx) => {
      const productId = toStr(row[idx.productId]);
      if (!isCuid(productId)) return { error: 'productId não é cuid' };
      const rating = toInt(row[idx.rating]);
      if (rating === null || rating < 1 || rating > 5) {
        return { error: 'rating fora de 1..5' };
      }
      const commentRaw = toStr(row[idx.comment]);
      if (commentRaw.length > 1000) return { error: 'comment > 1000 chars' };
      return {
        productId,
        rating,
        comment: commentRaw === '' ? null : commentRaw,
      };
    },
  );

  const expenses = mapCsvRows<ExpenseRow>(
    parseCsv(expTxt),
    ['receiptId', 'purchaseDate'],
    (row, idx) => {
      const purchaseDate = toDate(row[idx.purchaseDate]);
      const receiptId = toStr(row[idx.receiptId]);
      if (!receiptId) return { error: 'receiptId vazio' };
      return {
        receiptId,
        supermarketSlug: toStr(row[idx.supermarketSlug]) || null,
        purchaseDate,
        receiptTotal: toNum(row[idx.receiptTotal]),
        itemName: toStr(row[idx.itemName]) || null,
        itemRawText: toStr(row[idx.itemRawText]) || null,
        quantity: toNum(row[idx.quantity]),
        unitPrice: toNum(row[idx.unitPrice]),
        itemTotal: toNum(row[idx.itemTotal]),
      };
    },
  );

  return { favoritos, listas, alertas, reviews, expenses };
}
