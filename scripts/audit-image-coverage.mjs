#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Sprint 224 (MVP Bloco 2) — audit image coverage per supermarket.
 *
 * Query Neon direct via DATABASE_URL (cesta-api/.env). Count produtos com
 * imageUrl non-null agrupado por super ativo em prod.
 *
 * Usage:
 *   node scripts/audit-image-coverage.mjs
 *   DATABASE_URL=... node scripts/audit-image-coverage.mjs
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
  const envPath = resolve(__dirname, '..', 'cesta-api', '.env');
  try {
    const raw = readFileSync(envPath, 'utf8');
    const match = raw.match(/^DATABASE_URL=(.+)$/m);
    if (match) return match[1].replace(/^"|"$/g, '').trim();
  } catch {
    // fallthrough
  }
  throw new Error('DATABASE_URL not found (env or cesta-api/.env)');
}

async function main() {
  const databaseUrl = loadDatabaseUrl();
  process.env.DATABASE_URL = databaseUrl;
  const prisma = new PrismaClient();

  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        s.slug AS supermarket,
        s.name AS name,
        COUNT(DISTINCT p.id)::int AS total,
        COUNT(DISTINCT p.id) FILTER (WHERE p.image_url IS NOT NULL)::int AS with_image
      FROM products p
      JOIN product_prices pp ON pp.product_id = p.id
      JOIN supermarkets s ON s.id = pp.supermarket_id
      WHERE s.is_active = true
      GROUP BY s.slug, s.name
      ORDER BY total DESC
    `);

    let grandTotal = 0;
    let grandWithImage = 0;

    console.log('\nImage coverage per supermarket (prod Neon):');
    console.log('='.repeat(72));
    console.log(
      'slug'.padEnd(14) +
        'total'.padStart(8) +
        'with_image'.padStart(14) +
        '    coverage',
    );
    console.log('-'.repeat(72));
    for (const row of rows) {
      const total = Number(row.total);
      const withImage = Number(row.with_image);
      const pct = total > 0 ? (withImage / total) * 100 : 0;
      grandTotal += total;
      grandWithImage += withImage;
      console.log(
        String(row.supermarket).padEnd(14) +
          String(total).padStart(8) +
          String(withImage).padStart(14) +
          `    ${pct.toFixed(1).padStart(5)}%`,
      );
    }
    console.log('-'.repeat(72));
    const grandPct =
      grandTotal > 0 ? (grandWithImage / grandTotal) * 100 : 0;
    console.log(
      'TOTAL'.padEnd(14) +
        String(grandTotal).padStart(8) +
        String(grandWithImage).padStart(14) +
        `    ${grandPct.toFixed(1).padStart(5)}%`,
    );
    console.log('');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[audit-image-coverage] fatal:', err);
  process.exit(1);
});
