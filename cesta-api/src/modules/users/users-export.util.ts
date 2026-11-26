import JSZip from 'jszip';

const BOM = '﻿';

function csvField(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s: string;
  if (v instanceof Date) s = v.toISOString();
  else if (typeof v === 'object') s = JSON.stringify(v);
  else s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(cols: unknown[]): string {
  return cols.map(csvField).join(',');
}

function csv(headers: string[], rows: unknown[][]): string {
  return BOM + [csvRow(headers), ...rows.map(csvRow)].join('\r\n');
}

type Row = Record<string, unknown>;

function toNum(v: unknown): number | string {
  if (v === null || v === undefined) return '';
  const n = typeof v === 'object' && v !== null && 'toString' in v
    ? Number((v as { toString(): string }).toString())
    : Number(v);
  return Number.isFinite(n) ? n : '';
}

export function buildPerfilCsv(user: Row): string {
  return csv(
    [
      'id', 'email', 'phone', 'name', 'locale',
      'prefersVegan', 'prefersVegetarian', 'prefersGlutenFree', 'prefersLactoseFree',
      'cookieConsentLevel', 'createdAt',
    ],
    [[
      user.id, user.email, user.phone, user.name, user.locale,
      user.prefersVegan, user.prefersVegetarian, user.prefersGlutenFree, user.prefersLactoseFree,
      user.cookieConsentLevel, user.createdAt,
    ]],
  );
}

export function buildFavoritosCsv(favorites: Row[]): string {
  return csv(
    ['id', 'productId', 'productName', 'productBrand', 'createdAt'],
    favorites.map((f) => [
      f.id,
      f.productId,
      (f.product as Row | undefined)?.name ?? '',
      (f.product as Row | undefined)?.brand ?? '',
      f.createdAt,
    ]),
  );
}

export function buildListasCsv(lists: Row[]): string {
  const rows: unknown[][] = [];
  for (const l of lists) {
    const items = (l.items as Row[] | undefined) ?? [];
    if (items.length === 0) {
      rows.push([l.id, l.name, '', '', '', '', l.createdAt, l.updatedAt]);
      continue;
    }
    for (const it of items) {
      rows.push([
        l.id,
        l.name,
        it.productId,
        (it.product as Row | undefined)?.name ?? '',
        toNum(it.quantity),
        it.position,
        l.createdAt,
        l.updatedAt,
      ]);
    }
  }
  return csv(
    ['listId', 'listName', 'productId', 'productName', 'quantity', 'position', 'listCreatedAt', 'listUpdatedAt'],
    rows,
  );
}

export function buildAlertasCsv(alerts: Row[]): string {
  return csv(
    ['id', 'productId', 'productName', 'type', 'targetPrice', 'isActive', 'lastTriggeredAt', 'createdAt'],
    alerts.map((a) => [
      a.id,
      a.productId,
      (a.product as Row | undefined)?.name ?? '',
      a.type,
      toNum(a.targetPrice),
      a.isActive,
      a.lastTriggeredAt,
      a.createdAt,
    ]),
  );
}

export function buildReviewsCsv(reviews: Row[]): string {
  return csv(
    ['id', 'productId', 'productName', 'rating', 'comment', 'createdAt'],
    reviews.map((r) => [
      r.id,
      r.productId,
      (r.product as Row | undefined)?.name ?? '',
      r.rating,
      r.comment,
      r.createdAt,
    ]),
  );
}

export function buildExpensesCsv(receipts: Row[]): string {
  const rows: unknown[][] = [];
  for (const r of receipts) {
    const items = (r.items as Row[] | undefined) ?? [];
    if (items.length === 0) {
      rows.push([
        r.id, r.supermarketSlug ?? '', r.purchaseDate, toNum(r.total), r.status,
        '', '', '', '', '', r.createdAt,
      ]);
      continue;
    }
    for (const it of items) {
      rows.push([
        r.id,
        r.supermarketSlug ?? '',
        r.purchaseDate,
        toNum(r.total),
        r.status,
        it.normalizedName,
        it.rawText,
        toNum(it.quantity),
        toNum(it.unitPrice),
        toNum(it.total),
        r.createdAt,
      ]);
    }
  }
  return csv(
    [
      'receiptId', 'supermarketSlug', 'purchaseDate', 'receiptTotal', 'status',
      'itemName', 'itemRawText', 'quantity', 'unitPrice', 'itemTotal', 'receiptCreatedAt',
    ],
    rows,
  );
}

export interface ExportZip {
  zip: Buffer;
  filename: string;
  files: string[];
}

export async function buildExportZip(user: Row): Promise<ExportZip> {
  const zip = new JSZip();
  zip.file('perfil.csv', buildPerfilCsv(user));
  zip.file('favoritos.csv', buildFavoritosCsv((user.favorites as Row[]) ?? []));
  zip.file('listas.csv', buildListasCsv((user.shoppingLists as Row[]) ?? []));
  zip.file('alertas.csv', buildAlertasCsv((user.alerts as Row[]) ?? []));
  zip.file('reviews.csv', buildReviewsCsv((user.reviews as Row[]) ?? []));
  zip.file('expenses.csv', buildExpensesCsv((user.receipts as Row[]) ?? []));

  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `cesta-datos-${user.id}-${timestamp}.zip`;
  return {
    zip: buf,
    filename,
    files: ['perfil.csv', 'favoritos.csv', 'listas.csv', 'alertas.csv', 'reviews.csv', 'expenses.csv'],
  };
}
