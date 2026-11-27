#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Sprint 235 G3 diagnostic 2 — teto REAL marca nacional (Boss directive).
 *
 * Read-only. Filtra marcas próprias (Hacendado · Dia · Milsani · Alcampo ·
 * Aliada · Eroski · Froiz · Carrefour · etc) e conta quantos grupos
 * (brand_normalized + size_canonical) existem em >= 2 mercados distintos.
 *
 * Resultado = recall MÁXIMO possível pre-equivalente. Se o teto for
 * pequeno (ex: <50 grupos), confirma que matching exato marca nacional
 * sozinho NÃO é suficiente — precisa "produto equivalente" (marca
 * própria mesma categoria).
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import {
  extractBrand,
  effectiveSize,
} from './lib/brand-normalize.mjs';

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

// Marcas próprias dos supermercados espanhóis. Filtradas OUT porque não
// cruzam mercados.
const OWN_BRANDS = new Set(
  [
    'Hacendado',
    'Dia',
    'Dia Láctea',
    'Milsani',
    'Alcampo',
    'Auchan',
    'Aliada',
    'Produit',
    'Eroski',
    'Eroski Basic',
    'Eroski Selección',
    'Carrefour',
    'Carrefour Bio',
    'Carrefour Classic',
    'Froiz',
    'ElCorteIngles',
    'El Corte Inglés',
  ].map((s) => s.toLowerCase()),
);

function isOwnBrand(brand) {
  if (!brand) return false;
  return OWN_BRANDS.has(brand.toLowerCase());
}

function sizeKey(size) {
  if (!size) return '∅';
  return `${size.value}${size.unit}×${size.pack}`;
}

async function main() {
  process.env.DATABASE_URL = loadDatabaseUrl();
  const prisma = new PrismaClient();

  try {
    console.log('='.repeat(96));
    console.log('Sprint 235 G3 diagnostic 2 — teto real marca nacional');
    console.log('='.repeat(96));

    const products = await prisma.$queryRawUnsafe(`
      SELECT
        p.id, p.name, p.brand, p.package_size, p.package_unit,
        array_agg(DISTINCT s.slug) AS supermarkets
      FROM products p
      JOIN product_prices pp ON pp.product_id = p.id
      JOIN supermarkets s ON s.id = pp.supermarket_id
      WHERE p.deleted_at IS NULL
        AND p.canonical_product_id IS NULL
      GROUP BY p.id, p.name, p.brand, p.package_size, p.package_unit
    `);
    console.log(`\nTotal produtos ativos: ${products.length}`);

    // Enrich: extract brand + size.
    const enriched = products.map((p) => {
      const brandEff = p.brand ?? extractBrand(p.name);
      const sizeEff = effectiveSize(p.name, p.package_size, p.package_unit);
      return { ...p, brandEff, sizeEff };
    });

    // Split: own vs national.
    const own = enriched.filter((p) => isOwnBrand(p.brandEff));
    const national = enriched.filter(
      (p) => p.brandEff != null && !isOwnBrand(p.brandEff),
    );
    const unbranded = enriched.filter((p) => p.brandEff == null);

    console.log(`\nSplit por tipo de marca:`);
    console.log(`  Marcas próprias (filtradas OUT): ${own.length}`);
    console.log(`  Marcas nacionais (incluídas):    ${national.length}`);
    console.log(`  Sem marca detectada:             ${unbranded.length}`);

    // Group national by brand + size_key.
    const groups = new Map();
    for (const p of national) {
      const key = `${p.brandEff.toLowerCase()}|${sizeKey(p.sizeEff)}`;
      if (!groups.has(key)) {
        groups.set(key, {
          brand: p.brandEff,
          size: p.sizeEff,
          products: [],
          supermarkets: new Set(),
        });
      }
      const g = groups.get(key);
      g.products.push(p);
      for (const s of p.supermarkets) g.supermarkets.add(s);
    }

    // Count groups with >= 2 distinct supermarkets.
    const multiMarket = [];
    const singleMarket = [];
    for (const g of groups.values()) {
      if (g.supermarkets.size >= 2) multiMarket.push(g);
      else singleMarket.push(g);
    }

    console.log(`\nGrupos brand_nacional + size:`);
    console.log(`  Total:                 ${groups.size}`);
    console.log(`  Multi-mercado (≥ 2 supers): ${multiMarket.length}  ← **TETO REAL**`);
    console.log(`  Single-mercado:              ${singleMarket.length}`);

    // Top 30 multi-market groups by supermarket coverage.
    multiMarket.sort((a, b) => b.supermarkets.size - a.supermarkets.size);
    console.log(`\nTop 30 grupos multi-mercado (TETO G3 exato marca nacional):`);
    console.log('-'.repeat(96));
    for (const g of multiMarket.slice(0, 30)) {
      const supers = [...g.supermarkets].sort().join(',');
      const sample = g.products[0].name.slice(0, 44);
      console.log(
        `  ${g.brand.padEnd(18)} ${sizeKey(g.size).padEnd(10)} supers=${g.supermarkets.size} [${supers}] · "${sample}"`,
      );
    }

    // Breakdown per supermarket of national brand products.
    const perSuper = new Map();
    for (const p of national) {
      for (const s of p.supermarkets) {
        perSuper.set(s, (perSuper.get(s) ?? 0) + 1);
      }
    }
    console.log(`\nMarcas nacionais presentes per supermarket:`);
    console.log('-'.repeat(96));
    for (const [s, c] of [...perSuper.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${s.padEnd(14)} ${c}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
