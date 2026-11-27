#!/usr/bin/env node
// Sprint 222 — audit LIDL adapter catalog coverage.
//
// Classifies the adapter pattern (SEED_QUERIES vs category-tree vs other),
// counts distinct DB products for supermarket.slug='lidl', and inspects the
// latest SyncRun row for lidl to estimate real-world yield per run.
//
// LIDL uses pattern SEED_QUERIES (S186) with fixed endpoint response size
// per query (~48 erpNumber anchors, no pagination). Expansion strategy
// mirrors S218 DIA (41→81 queries) — gap-fill Spanish grocery vocabulary.
//
// No external HTTP calls — relies on the static adapter source + DB.
//
// Usage:
//   node scripts/audit-lidl-adapter.mjs [--out=path.json] [--skip-db]

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

function parseFlags() {
  const args = process.argv.slice(2);
  const out = args.find((a) => a.startsWith('--out='))?.split('=')[1] ?? null;
  const skipDb = args.includes('--skip-db');
  return { out, skipDb };
}

function loadAdapterSource() {
  const here = dirname(fileURLToPath(import.meta.url));
  const adapterPath = resolve(
    here,
    '..',
    'src',
    'modules',
    'catalog-sync',
    'adapters',
    'lidl.adapter.ts',
  );
  return { adapterPath, src: readFileSync(adapterPath, 'utf8') };
}

function classify(src) {
  const seedMatch = src.match(/const\s+SEED_QUERIES\s*=\s*\[([\s\S]*?)\];/);
  const treeHint = /categories\/|category[-_]tree|walkCategor/i.test(src);
  const scrapeHint = /cheerio|parse5/i.test(src);
  if (seedMatch) {
    const queries = seedMatch[1]
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter((s) => s.startsWith("'") || s.startsWith('"'))
      .map((s) => s.slice(1, -1));
    return { pattern: 'SEED_QUERIES', queries };
  }
  if (treeHint) return { pattern: 'category-tree', queries: [] };
  if (scrapeHint) return { pattern: 'html-scrape', queries: [] };
  return { pattern: 'other', queries: [] };
}

function detectCaps(src) {
  const maxQueries = src.match(/MAX_QUERIES\s*=\s*(\d+)/)?.[1] ?? null;
  return { maxQueries };
}

async function dbStats() {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const sm = await prisma.supermarket.findUnique({
        where: { slug: 'lidl' },
      });
      if (!sm) return { ok: true, note: 'no lidl supermarket row' };

      const priceCount = await prisma.productPrice.count({
        where: { supermarketId: sm.id },
      });

      const latestSync = await prisma.syncRun
        .findFirst({
          where: { supermarketSlug: 'lidl' },
          orderBy: { startedAt: 'desc' },
        })
        .catch(() => null);

      return {
        ok: true,
        supermarketId: sm.id,
        productPrices: priceCount,
        latestSync: latestSync
          ? {
              id: latestSync.id,
              startedAt: latestSync.startedAt,
              finishedAt: latestSync.finishedAt,
              status: latestSync.status,
              itemsProcessed: latestSync.itemsProcessed,
              itemsCreated: latestSync.itemsCreated,
              itemsUpdated: latestSync.itemsUpdated,
              itemsCandidate: latestSync.itemsCandidate,
              itemsFailed: latestSync.itemsFailed,
            }
          : null,
      };
    } finally {
      await prisma.$disconnect();
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function main() {
  const { out, skipDb } = parseFlags();
  const { adapterPath, src } = loadAdapterSource();
  const { pattern, queries } = classify(src);
  const caps = detectCaps(src);

  // Live-probed 2026-11-27 contra https://www.lidl.es/q/search?q=<q>&type=json:
  //   12 queries sample (incluindo 8 novos candidatos pós-S186):
  //     leche 48, yogur 48, platano 48, cebolla 46, pimiento 47, croissant 46,
  //     salchicha 48, bacalao 47, gambas 48, pienso perro 48, vinagre 46,
  //     pasta dentifrica 47
  //   avg: ~47 erpNumber anchors / query (teto fixo endpoint, sem paginação)
  //
  // Current LIDL array: 43 queries (comment diz 40, array tem 43).
  // Current cap MAX_QUERIES=40 (trunca array).
  //
  // Conclusão: pattern S218 DIA aplica (expand gap Spanish grocery). Target
  // 81 queries (alinhado DIA pós-S218). Ceiling pre-dedup ~81 × 47 = ~3807.
  // Dedup entre queries estimado 40-60% overlap → unique ~1500-2300.
  // DB pre-S222 ~908 → target ≥1044 (+15%) fácil com margem; esperado
  // crescer 1500-2000.
  const avgAnchorsPerQuery = 47;
  const maxQueries = caps.maxQueries ? Number(caps.maxQueries) : queries.length;
  const effectiveQueries = Math.min(maxQueries, queries.length);
  const theoreticalCeiling = effectiveQueries * avgAnchorsPerQuery;

  console.log(`[audit-lidl] adapter: ${adapterPath}`);
  console.log(`[audit-lidl] pattern: ${pattern}`);
  console.log(`[audit-lidl] seed queries declared: ${queries.length}`);
  console.log(`[audit-lidl] max queries cap: ${caps.maxQueries ?? 'none'}`);
  console.log(`[audit-lidl] effective queries: ${effectiveQueries}`);
  console.log(`[audit-lidl] avg anchors/query (sampled): ~${avgAnchorsPerQuery}`);
  console.log(`[audit-lidl] theoretical ceiling: ~${theoreticalCeiling} (pre-dedup)`);

  const db = skipDb ? { ok: false, error: 'skipped' } : await dbStats();

  console.log('');
  console.log('[audit-lidl] SUMMARY');
  console.log(`  pattern:                 ${pattern}`);
  console.log(`  seed queries declared:   ${queries.length}`);
  console.log(`  max queries cap:         ${caps.maxQueries ?? 'none'}`);
  console.log(`  effective queries:       ${effectiveQueries}`);
  console.log(`  avg anchors / query:     ~${avgAnchorsPerQuery} (sampled)`);
  console.log(`  theoretical ceiling:     ~${theoreticalCeiling} (pre-dedup)`);
  if (db.ok) {
    console.log(`  DB productPrices (lidl): ${db.productPrices ?? 'n/a'}`);
    if (db.latestSync) {
      const ls = db.latestSync;
      console.log(
        `  latest sync:             ${ls.status} @ ${ls.startedAt?.toISOString?.() ?? ls.startedAt}`,
      );
      console.log(
        `  processed/created/updated/candidate/failed: ${ls.itemsProcessed}/${ls.itemsCreated}/${ls.itemsUpdated}/${ls.itemsCandidate}/${ls.itemsFailed}`,
      );
    } else {
      console.log(`  latest sync:             none`);
    }
    if (theoreticalCeiling && db.productPrices) {
      const cov = (db.productPrices / theoreticalCeiling) * 100;
      console.log(
        `  coverage estimate:       ${cov.toFixed(1)}% (DB / theoretical ceiling)`,
      );
    }
  } else {
    console.log(`  DB stats unavailable:    ${db.error}`);
  }

  const report = {
    adapterPath,
    pattern,
    seedQueries: queries,
    caps,
    effectiveQueries,
    avgAnchorsPerQuery,
    theoreticalCeiling,
    db,
    generatedAt: new Date().toISOString(),
  };

  if (out) {
    writeFileSync(out, JSON.stringify(report, null, 2));
    console.log(`[audit-lidl] wrote ${out}`);
  }
}

main().catch((err) => {
  console.error('[audit-lidl] fatal:', err);
  process.exit(1);
});
