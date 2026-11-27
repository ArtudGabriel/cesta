#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Sprint 228 G2 (ADR 0037) — audit da reconciliação canônica cross-mercado.
 *
 * Mede:
 *   1. Total products ativos.
 *   2. Canonical (canonicalProductId IS NULL · ean populado opcional).
 *   3. Duplicates linkados (canonicalProductId IS NOT NULL).
 *   4. Canonicals com >=2 supermarkets distintos em ProductPrice
 *      (multi-market signal — métrica G4).
 *   5. Breakdown per supermarket: quantos ProductPrice apontam pro canonical.
 *
 * Boss guard (2026-11-27): read-only, idempotente, zero write. Usar antes e
 * depois de rodar `scripts/merge-canonicals.mjs` pra confirmar efeito.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require_ = createRequire(
  resolve(__dirname, '..', 'cesta-api', 'package.json'),
);
const { PrismaClient } = require_('@prisma/client');

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const raw = readFileSync(resolve(__dirname, '..', 'cesta-api', '.env'), 'utf8');
  const m = raw.match(/^DATABASE_URL=(.+)$/m);
  if (m) return m[1].replace(/^"|"$/g, '').trim();
  throw new Error('DATABASE_URL not found');
}

function pct(n, d) {
  if (!d) return '  n/a';
  return `${((100 * n) / d).toFixed(1)}%`.padStart(6);
}

async function overview(prisma) {
  const [row] = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE canonical_product_id IS NULL)::int AS canonicals,
      COUNT(*) FILTER (WHERE canonical_product_id IS NOT NULL)::int AS duplicates,
      COUNT(*) FILTER (WHERE canonical_product_id IS NULL AND ean IS NOT NULL)::int AS canonicals_with_ean
    FROM products
    WHERE deleted_at IS NULL
  `);
  console.log('\n[S228 G2] Canonical merge overview:');
  console.log('='.repeat(72));
  console.log(`total products:         ${row.total}`);
  console.log(`canonicals:             ${row.canonicals} (${pct(row.canonicals, row.total).trim()})`);
  console.log(`  of which with EAN:    ${row.canonicals_with_ean}`);
  console.log(`duplicates (linked):    ${row.duplicates} (${pct(row.duplicates, row.total).trim()})`);
}

async function multiMarketCanonicals(prisma) {
  const [row] = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(DISTINCT p.id)::int AS total_canonicals_with_prices,
      COUNT(DISTINCT CASE WHEN agg.market_count >= 2 THEN p.id END)::int AS multi_market,
      COUNT(DISTINCT CASE WHEN agg.market_count = 1 THEN p.id END)::int AS single_market
    FROM products p
    JOIN (
      SELECT product_id, COUNT(DISTINCT supermarket_id) AS market_count
      FROM product_prices
      GROUP BY product_id
    ) agg ON agg.product_id = p.id
    WHERE p.deleted_at IS NULL
      AND p.canonical_product_id IS NULL
  `);
  console.log('\n[S228 G2] Multi-market canonicals:');
  console.log('='.repeat(72));
  console.log(`canonicals with prices: ${row.total_canonicals_with_prices}`);
  console.log(
    `  single_market:        ${row.single_market} (${pct(row.single_market, row.total_canonicals_with_prices).trim()})`,
  );
  console.log(
    `  multi_market (G4):    ${row.multi_market} (${pct(row.multi_market, row.total_canonicals_with_prices).trim()})`,
  );
}

async function linkedBySupermarket(prisma) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      s.slug,
      COUNT(DISTINCT p.id)::int AS linked_duplicates
    FROM products p
    JOIN product_prices pp ON pp.product_id = p.id
    JOIN supermarkets s ON s.id = pp.supermarket_id
    WHERE p.canonical_product_id IS NOT NULL
      AND p.deleted_at IS NULL
    GROUP BY s.slug
    ORDER BY linked_duplicates DESC
  `);
  if (rows.length === 0) {
    console.log('\n[S228 G2] Linked duplicates per supermarket: (none yet)');
    return;
  }
  console.log('\n[S228 G2] Linked duplicates per supermarket:');
  console.log('='.repeat(72));
  console.log('slug'.padEnd(14) + 'linked_duplicates'.padStart(20));
  console.log('-'.repeat(72));
  for (const r of rows) {
    console.log(String(r.slug).padEnd(14) + String(r.linked_duplicates).padStart(20));
  }
}

async function main() {
  process.env.DATABASE_URL = loadDatabaseUrl();
  const prisma = new PrismaClient();
  try {
    await overview(prisma);
    await multiMarketCanonicals(prisma);
    await linkedBySupermarket(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
