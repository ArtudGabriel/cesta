#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Sprint 234 G3 recall fix (ADR 0041) — soft-delete prices seed em
 * mercados falsos.
 *
 * Boss diagnostic 2026-11-27 19:16Z: 27 produtos seed inicial (S119
 * demo data) têm prices em 7 mercados (ex: Hacendado — marca
 * Mercadona — figura em aldi/carrefour/alcampo com preço fictício
 * seed). Isso polui métrica cross-mercado + atrapalha cluster matching.
 *
 * Alvo: `ProductPrice WHERE source = 'seed'`. Soft-delete via
 * `deleted_at = NOW()` (schema S234 adicionou a coluna). Price row
 * fica no DB — reversível via `UPDATE SET deleted_at = NULL`.
 *
 * Boss guards (herdadas):
 *  1. Aditivo — schema já tem coluna nullable (ADR 0041 migration).
 *  2. LIGA, não apaga — nunca DELETE row · só UPDATE deleted_at.
 *  3. PITR Neon antes --apply · reminder impresso.
 *  4. Dry-run default · --apply opt-in · filtro `deleted_at IS NULL`
 *     idempotente (re-run = zero mudança).
 *  5. Rollback: UPDATE product_prices SET deleted_at = NULL WHERE
 *     deleted_at > '<timestamp>' AND source = 'seed';
 *
 * Uso:
 *   node scripts/cleanup-seed-prices.mjs             # dry-run (default)
 *   node scripts/cleanup-seed-prices.mjs --apply     # grava
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

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    apply: args.includes('--apply'),
    dryRun: !args.includes('--apply'),
  };
}

async function main() {
  const { apply, dryRun } = parseArgs();
  process.env.DATABASE_URL = loadDatabaseUrl();
  const prisma = new PrismaClient();

  try {
    console.log('='.repeat(72));
    console.log('Sprint 234 G3 recall — cleanup-seed-prices');
    console.log('='.repeat(72));
    console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'APPLY'}`);
    const nowUtc = new Date().toISOString();
    if (apply) {
      console.log('\n⚠️  Boss guard: snapshot Neon ANTES de continuar.');
      console.log(`   PITR timestamp (cole no PR): ${nowUtc}`);
      console.log(`   Rollback SQL:`);
      console.log(`     UPDATE product_prices SET deleted_at = NULL`);
      console.log(`       WHERE deleted_at IS NOT NULL AND source = 'seed';`);
    }

    // Preview counts per supermarket.
    const breakdown = await prisma.$queryRawUnsafe(`
      SELECT s.slug, COUNT(*)::int AS seed_prices
      FROM product_prices pp
      JOIN supermarkets s ON s.id = pp.supermarket_id
      WHERE pp.source = 'seed' AND pp.deleted_at IS NULL
      GROUP BY s.slug
      ORDER BY seed_prices DESC
    `);

    const total = breakdown.reduce((s, r) => s + r.seed_prices, 0);
    console.log(`\nSeed prices ativos (source='seed' · deleted_at IS NULL): ${total}`);
    if (breakdown.length > 0) {
      console.log('\nPer supermarket:');
      console.log('-'.repeat(72));
      for (const r of breakdown) {
        console.log(`  ${r.slug.padEnd(14)} ${String(r.seed_prices).padStart(8)}`);
      }
    }

    // Preview sample 10 affected products.
    const sample = await prisma.$queryRawUnsafe(`
      SELECT p.id, p.name, p.brand, s.slug AS super_slug
      FROM product_prices pp
      JOIN products p ON p.id = pp.product_id
      JOIN supermarkets s ON s.id = pp.supermarket_id
      WHERE pp.source = 'seed' AND pp.deleted_at IS NULL
      ORDER BY p.id, s.slug
      LIMIT 10
    `);
    if (sample.length > 0) {
      console.log('\nSample (10 primeiros):');
      console.log('-'.repeat(72));
      for (const r of sample) {
        console.log(
          `  ${r.super_slug.padEnd(12)} ${(r.brand ?? '∅').padEnd(14)} "${r.name.slice(0, 40)}"`,
        );
      }
    }

    if (total === 0) {
      console.log('\nNada a fazer. Catálogo já sem seed prices ativos.');
      return;
    }

    if (dryRun) {
      console.log('\n--dry-run: Nenhuma mudança gravada. Para aplicar: --apply');
      return;
    }

    const r = await prisma.productPrice.updateMany({
      where: {
        source: 'seed',
        deletedAt: null,
      },
      data: { deletedAt: new Date(nowUtc) },
    });
    console.log(`\n✅ Apply concluído. ${r.count} prices seed soft-deletadas.`);
    console.log('   Próximo: node scripts/audit-trigram-match.mjs');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
