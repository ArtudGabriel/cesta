#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Sprint 228 G2 (ADR 0037) — merge histórico de duplicatas cross-mercado.
 *
 * Catalog-sync faz o link em RUNTIME quando adapter traz EAN (futuro).
 * Este script faz a passagem HISTÓRICA: scanneia o DB atual, identifica
 * Products canônicos (ean IS NOT NULL) e aponta duplicatas (ean IS NULL
 * · mesmo normalized_name) via canonical_product_id.
 *
 * **Boss guards (2026-11-27)**:
 *  1. Migration aditiva — zero drop/delete. ✓ (só UPDATE canonical_product_id).
 *  2. Merge = LIGAR, não apagar. ✓ (duplicates ficam · UI filtra em G4).
 *  3. Snapshot Neon antes de rodar em prod. Script imprime reminder.
 *  4. Dry-run (default) imprime contagem antes · --apply grava.
 *  5. Idempotente: re-run = zero mudança (filtro canonical_product_id IS NULL).
 *
 * Uso:
 *   node scripts/merge-canonicals.mjs             # dry-run
 *   node scripts/merge-canonicals.mjs --apply     # grava
 *
 * Rollback (SQL raw):
 *   UPDATE products SET canonical_product_id = NULL
 *     WHERE canonical_product_id IS NOT NULL;
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

async function findMergeCandidates(prisma) {
  // Para cada canônico (ean IS NOT NULL · canonical_product_id IS NULL),
  // encontra Products com mesmo normalized_name e ean IS NULL que ainda
  // não foram linkados. SQL raw por eficiência (joins self na mesma
  // tabela via normalized_name).
  return prisma.$queryRawUnsafe(`
    SELECT
      c.id AS canonical_id,
      c.name AS canonical_name,
      c.ean AS canonical_ean,
      d.id AS duplicate_id,
      d.name AS duplicate_name
    FROM products c
    JOIN products d
      ON d.normalized_name = c.normalized_name
      AND d.id != c.id
      AND d.ean IS NULL
      AND d.canonical_product_id IS NULL
      AND d.deleted_at IS NULL
    WHERE c.deleted_at IS NULL
      AND c.ean IS NOT NULL
      AND c.canonical_product_id IS NULL
    ORDER BY c.normalized_name, c.id
    LIMIT 10000
  `);
}

async function main() {
  const { apply, dryRun } = parseArgs();
  process.env.DATABASE_URL = loadDatabaseUrl();
  const prisma = new PrismaClient();

  try {
    console.log('='.repeat(72));
    console.log('Sprint 228 G2 — merge-canonicals histórico');
    console.log('='.repeat(72));
    if (dryRun) {
      console.log('Mode: DRY-RUN (nada será gravado)');
    } else {
      console.log('Mode: APPLY (gravará canonical_product_id)');
      console.log('\n⚠️  Boss guard: confirme que snapshot Neon foi tirado ANTES de continuar.');
      console.log('   Branch Neon: https://console.neon.tech/app/projects → create branch.');
      console.log('   Rollback: UPDATE products SET canonical_product_id = NULL WHERE canonical_product_id IS NOT NULL;');
    }

    const candidates = await findMergeCandidates(prisma);
    console.log(`\nCandidatos encontrados: ${candidates.length}`);

    if (candidates.length === 0) {
      console.log('Nada a fazer. Catálogo já consolidado ou vazio.');
      return;
    }

    // Preview das 10 primeiras pra sanity check visual.
    console.log('\nPreview (até 10 primeiras):');
    console.log('-'.repeat(72));
    for (const c of candidates.slice(0, 10)) {
      console.log(
        `  ${c.duplicate_id.slice(0, 8)} "${c.duplicate_name.slice(0, 40)}" → ${c.canonical_id.slice(0, 8)} "${c.canonical_name.slice(0, 40)}" (ean=${c.canonical_ean})`,
      );
    }
    if (candidates.length > 10) {
      console.log(`  ... (+${candidates.length - 10} mais)`);
    }

    // Agregações pra relatório.
    const byCanonicalMap = new Map();
    for (const c of candidates) {
      byCanonicalMap.set(
        c.canonical_id,
        (byCanonicalMap.get(c.canonical_id) ?? 0) + 1,
      );
    }
    console.log(`\nCanonicals impactados: ${byCanonicalMap.size}`);
    console.log(`Média duplicates por canonical: ${(candidates.length / byCanonicalMap.size).toFixed(2)}`);

    if (dryRun) {
      console.log('\n--dry-run: Nenhuma mudança gravada. Para aplicar: node scripts/merge-canonicals.mjs --apply');
      return;
    }

    // Apply: update em lotes de 500 pra não sobrecarregar Neon.
    const BATCH = 500;
    let processed = 0;
    for (let i = 0; i < candidates.length; i += BATCH) {
      const batch = candidates.slice(i, i + BATCH);
      // Agrupa por canonical pra reduzir updateMany calls.
      const byCanonical = new Map();
      for (const c of batch) {
        if (!byCanonical.has(c.canonical_id)) byCanonical.set(c.canonical_id, []);
        byCanonical.get(c.canonical_id).push(c.duplicate_id);
      }
      for (const [canonicalId, duplicateIds] of byCanonical) {
        await prisma.product.updateMany({
          where: {
            id: { in: duplicateIds },
            canonicalProductId: null, // idempotência final
            ean: null,
          },
          data: { canonicalProductId: canonicalId },
        });
      }
      processed += batch.length;
      console.log(`  progresso: ${processed}/${candidates.length}`);
    }
    console.log(`\n✅ Apply concluído. ${processed} duplicates vinculados.`);
    console.log('   Próximo passo: node scripts/audit-canonical-merge.mjs');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
