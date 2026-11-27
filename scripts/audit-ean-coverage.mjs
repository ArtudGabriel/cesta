#!/usr/bin/env node
/* eslint-disable no-console */
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

async function main() {
  process.env.DATABASE_URL = loadDatabaseUrl();
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        s.slug,
        COUNT(DISTINCT p.id)::int AS total_missing_image,
        COUNT(DISTINCT p.id) FILTER (WHERE p.ean IS NOT NULL)::int AS with_ean,
        COUNT(DISTINCT p.id) FILTER (WHERE p.ean IS NULL)::int AS without_ean
      FROM products p
      JOIN product_prices pp ON pp.product_id = p.id
      JOIN supermarkets s ON s.id = pp.supermarket_id
      WHERE s.is_active = true AND p.image_url IS NULL
      GROUP BY s.slug
      ORDER BY total_missing_image DESC
    `);
    console.log('\nMissing-image products EAN breakdown:');
    console.log('='.repeat(72));
    console.log(
      'slug'.padEnd(14) +
        'missing'.padStart(10) +
        'with_ean'.padStart(12) +
        'without_ean'.padStart(14),
    );
    console.log('-'.repeat(72));
    for (const r of rows) {
      console.log(
        String(r.slug).padEnd(14) +
          String(r.total_missing_image).padStart(10) +
          String(r.with_ean).padStart(12) +
          String(r.without_ean).padStart(14),
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
