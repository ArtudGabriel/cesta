#!/usr/bin/env node
// Sprint 218 — audit DIA adapter catalog coverage.
//
// Classifies the adapter pattern (SEED_QUERIES list vs category-tree vs other),
// counts distinct DB products for supermarket.slug='dia', and inspects the
// latest SyncRun row for dia to estimate real-world yield per run.
//
// No external HTTP calls — relies on the static adapter source + DB.
// Prod sync numbers (in SyncRun.rawPayload / counters) are the ceiling.
//
// Usage:
//   node scripts/audit-dia-adapter.mjs [--out=path.json] [--skip-db]

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
    'dia.adapter.ts',
  );
  return { adapterPath, src: readFileSync(adapterPath, 'utf8') };
}

function classify(src) {
  const seedMatch = src.match(/const\s+SEED_QUERIES\s*=\s*\[([\s\S]*?)\];/);
  const treeHint = /categories\/|category[-_]tree|walkCategor/i.test(src);
  const scrapeHint = /cheerio|parse5|\$\(['"]/i.test(src);
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

function detectPagination(src) {
  const pageSize = src.match(/page_size.*?(\d+)/)?.[1] ?? null;
  const maxPagesConst = src.match(/MAX_PAGES_PER_QUERY\s*=\s*(\d+)/)?.[1] ?? null;
  return { pageSize, maxPages: maxPagesConst };
}

async function dbStats() {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const sm = await prisma.supermarket.findUnique({
        where: { slug: 'dia' },
      });
      if (!sm) return { ok: true, note: 'no dia supermarket row' };

      const priceCount = await prisma.productPrice.count({
        where: { supermarketId: sm.id },
      });

      const latestSync = await prisma.syncRun
        .findFirst({
          where: { supermarketSlug: 'dia' },
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
  const paging = detectPagination(src);

  console.log(`[audit-dia] adapter: ${adapterPath}`);
  console.log(`[audit-dia] pattern: ${pattern}`);
  console.log(`[audit-dia] seed queries: ${queries.length}`);
  console.log(`[audit-dia] pagination: pageSize=${paging.pageSize} maxPages=${paging.maxPages}`);

  const ceilingPerQuery =
    paging.pageSize && paging.maxPages
      ? Number(paging.pageSize) * Number(paging.maxPages)
      : null;
  const theoreticalCeiling =
    ceilingPerQuery && queries.length ? ceilingPerQuery * queries.length : null;

  const db = skipDb ? { ok: false, error: 'skipped' } : await dbStats();

  console.log('');
  console.log('[audit-dia] SUMMARY');
  console.log(`  pattern:                 ${pattern}`);
  console.log(`  seed queries:            ${queries.length}`);
  console.log(`  ceiling per query:       ~${ceilingPerQuery ?? '?'}  (pageSize × maxPages)`);
  console.log(
    `  theoretical ceiling:     ~${theoreticalCeiling ?? '?'}  (ceilingPerQuery × queries, pre-dedup)`,
  );
  if (db.ok) {
    console.log(`  DB productPrices (dia):  ${db.productPrices ?? 'n/a'}`);
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
      console.log(`  coverage estimate:       ${cov.toFixed(1)}% (DB / theoretical ceiling)`);
    }
  } else {
    console.log(`  DB stats unavailable:    ${db.error}`);
  }

  const report = {
    adapterPath,
    pattern,
    seedQueries: queries,
    pagination: paging,
    ceilingPerQuery,
    theoreticalCeiling,
    db,
    generatedAt: new Date().toISOString(),
  };

  if (out) {
    writeFileSync(out, JSON.stringify(report, null, 2));
    console.log(`[audit-dia] wrote ${out}`);
  }
}

main().catch((err) => {
  console.error('[audit-dia] fatal:', err);
  process.exit(1);
});
