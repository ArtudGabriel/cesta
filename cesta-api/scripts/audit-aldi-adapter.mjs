#!/usr/bin/env node
// Sprint 219 — audit Aldi adapter catalog coverage.
//
// Classifies the adapter pattern (SEED_QUERIES vs category-tree vs html-scrape
// vs sitemap+detail), counts distinct DB products for supermarket.slug='aldi',
// and inspects the latest SyncRun row for aldi to estimate real-world yield.
//
// Aldi is neither pure SEED_QUERIES nor tree: pre-S219 it was html-scrape of a
// single endpoint (/es/ofertas.html, 192 SSR tiles). S219 shifts it to a
// sitemap + JSON-LD detail crawl (2966 sitemap URLs cap).
//
// No external HTTP calls — relies on the static adapter source + DB.
//
// Usage:
//   node scripts/audit-aldi-adapter.mjs [--out=path.json] [--skip-db]

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
    'aldi.adapter.ts',
  );
  return { adapterPath, src: readFileSync(adapterPath, 'utf8') };
}

function classify(src) {
  const seedMatch = src.match(/const\s+SEED_QUERIES\s*=\s*\[([\s\S]*?)\];/);
  const sitemapHint = /sitemap[-_]products|SITEMAP_URL/i.test(src);
  const jsonLdHint = /application\/ld\+json|@type.*Product/i.test(src);
  const treeHint = /categories\/|category[-_]tree|walkCategor/i.test(src);
  const scrapeHint = /cheerio|parse5/i.test(src);

  if (sitemapHint && jsonLdHint) return { pattern: 'sitemap+jsonld', queries: [] };
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
  const maxProducts =
    src.match(/ALDI_MAX_PRODUCTS[^0-9]*?(\d+)/)?.[1] ??
    src.match(/MAX_PRODUCTS\s*=\s*(\d+)/)?.[1] ??
    null;
  const ofertasCeiling = /OFERTAS_URL/.test(src) ? 192 : null;
  return { maxProducts, ofertasCeiling };
}

async function dbStats() {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const sm = await prisma.supermarket.findUnique({ where: { slug: 'aldi' } });
      if (!sm) return { ok: true, note: 'no aldi supermarket row' };

      const priceCount = await prisma.productPrice.count({
        where: { supermarketId: sm.id },
      });

      const latestSync = await prisma.syncRun
        .findFirst({
          where: { supermarketSlug: 'aldi' },
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

  const sitemapCeiling = 2966; // S219 probe live aldi.es/sitemaps/.aldi-nord-sitemap-products.xml
  const theoreticalCeiling =
    pattern === 'sitemap+jsonld' && caps.maxProducts
      ? Math.min(Number(caps.maxProducts), sitemapCeiling)
      : pattern === 'html-scrape'
        ? caps.ofertasCeiling
        : null;

  console.log(`[audit-aldi] adapter: ${adapterPath}`);
  console.log(`[audit-aldi] pattern: ${pattern}`);
  console.log(`[audit-aldi] seed queries: ${queries.length}`);
  console.log(
    `[audit-aldi] caps: ofertasCeiling=${caps.ofertasCeiling ?? '?'} maxProducts=${caps.maxProducts ?? '?'} sitemapCeiling=${sitemapCeiling}`,
  );

  const db = skipDb ? { ok: false, error: 'skipped' } : await dbStats();

  console.log('');
  console.log('[audit-aldi] SUMMARY');
  console.log(`  pattern:                 ${pattern}`);
  console.log(`  ofertas SSR ceiling:     ~${caps.ofertasCeiling ?? '?'} tiles (promo page)`);
  console.log(`  sitemap product ceiling: ~${sitemapCeiling} URLs (real catalog)`);
  console.log(`  configured cap:          ${caps.maxProducts ?? 'none'}`);
  console.log(`  effective ceiling:       ~${theoreticalCeiling ?? '?'}`);
  if (db.ok) {
    console.log(`  DB productPrices (aldi): ${db.productPrices ?? 'n/a'}`);
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
      console.log(`  coverage estimate:       ${cov.toFixed(1)}% (DB / effective ceiling)`);
    }
    if (sitemapCeiling && db.productPrices) {
      const potential = (db.productPrices / sitemapCeiling) * 100;
      console.log(`  full-catalog coverage:   ${potential.toFixed(1)}% (DB / sitemap ceiling)`);
    }
  } else {
    console.log(`  DB stats unavailable:    ${db.error}`);
  }

  const report = {
    adapterPath,
    pattern,
    seedQueries: queries,
    caps,
    sitemapCeiling,
    theoreticalCeiling,
    db,
    generatedAt: new Date().toISOString(),
  };

  if (out) {
    writeFileSync(out, JSON.stringify(report, null, 2));
    console.log(`[audit-aldi] wrote ${out}`);
  }
}

main().catch((err) => {
  console.error('[audit-aldi] fatal:', err);
  process.exit(1);
});
