#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Sprint 229 G3 (ADR 0039) — audit do matching trigram + review queue.
 *
 * Mede:
 *   1. Trigram linked (canonicalProductId NOT NULL · sem EAN) — chain G3.
 *   2. Review queue (product_match_reviews por status).
 *   3. Top 200 itens básicos cross-market match % (métrica Boss).
 *
 * Read-only. Rodar antes/depois de `match-trigram.mjs --apply`.
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
  return `${((100 * n) / d).toFixed(1)}%`;
}

async function trigramLinked(prisma) {
  const [row] = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(*) FILTER (WHERE canonical_product_id IS NOT NULL AND ean IS NULL)::int AS trigram_linked,
      COUNT(*) FILTER (WHERE canonical_product_id IS NULL AND ean IS NULL)::int AS unlinked_no_ean
    FROM products
    WHERE deleted_at IS NULL
  `);
  console.log('\n[S229 G3] Trigram-linked products:');
  console.log('='.repeat(72));
  console.log(`linked via trigram (ean=null + canonical set): ${row.trigram_linked}`);
  console.log(`still unlinked (ean=null + no canonical):      ${row.unlinked_no_ean}`);
}

async function reviewQueue(prisma) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT status, COUNT(*)::int AS total,
           AVG(similarity_score)::float AS avg_score
    FROM product_match_reviews
    GROUP BY status
    ORDER BY status
  `);
  console.log('\n[S229 G3] Review queue (product_match_reviews):');
  console.log('='.repeat(72));
  if (rows.length === 0) {
    console.log('(vazia)');
    return;
  }
  console.log('status'.padEnd(12) + 'total'.padStart(10) + 'avg_score'.padStart(12));
  console.log('-'.repeat(72));
  for (const r of rows) {
    console.log(
      String(r.status).padEnd(12) +
        String(r.total).padStart(10) +
        (Number(r.avg_score).toFixed(3)).padStart(12),
    );
  }
}

// Top itens básicos pros usuários espanhóis (keyword search cross-market).
const TOP_ITEMS = [
  'leche',
  'pan',
  'huevos',
  'yogur',
  'queso',
  'mantequilla',
  'aceite oliva',
  'arroz',
  'pasta',
  'coca cola',
  'cerveza',
  'agua',
  'zumo',
  'cafe',
  'chocolate',
  'pollo',
  'jamon',
  'salmon',
  'atun',
  'tomate',
  'patatas',
  'cebolla',
  'manzana',
  'platano',
  'detergente',
  'papel higienico',
  'champu',
  'pasta dentifrica',
  'pienso perro',
];

async function topItemsCoverage(prisma) {
  console.log('\n[S229 G3] Top itens básicos — canonicals com N mercados:');
  console.log('='.repeat(72));
  console.log('query'.padEnd(20) + 'canonicals'.padStart(12) + 'avg_markets'.padStart(14) + 'max_markets'.padStart(12));
  console.log('-'.repeat(72));
  for (const q of TOP_ITEMS) {
    const [row] = await prisma.$queryRawUnsafe(
      `
      SELECT
        COUNT(DISTINCT p.id)::int AS canonicals,
        AVG(agg.market_count)::float AS avg_markets,
        MAX(agg.market_count)::int AS max_markets
      FROM products p
      JOIN (
        SELECT product_id, COUNT(DISTINCT supermarket_id) AS market_count
        FROM product_prices
        GROUP BY product_id
      ) agg ON agg.product_id = p.id
      WHERE p.deleted_at IS NULL
        AND p.canonical_product_id IS NULL
        AND (p.name ILIKE $1 OR p.brand ILIKE $1)
      `,
      `%${q}%`,
    );
    console.log(
      q.padEnd(20) +
        String(row.canonicals).padStart(12) +
        (row.avg_markets != null ? Number(row.avg_markets).toFixed(2) : 'n/a').padStart(14) +
        String(row.max_markets ?? 0).padStart(12),
    );
  }
}

async function main() {
  process.env.DATABASE_URL = loadDatabaseUrl();
  const prisma = new PrismaClient();
  try {
    await trigramLinked(prisma);
    await reviewQueue(prisma);
    await topItemsCoverage(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
