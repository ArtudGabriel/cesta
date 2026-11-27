#!/usr/bin/env node
// Sprint 221 — audit Froiz adapter catalog coverage.
//
// Classifies the adapter pattern (SEED_QUERIES vs category-tree vs
// sitemap+JSON-LD vs sitemap+html-data-metrics vs sitemap+html-cards),
// counts distinct DB products for supermarket.slug='froiz', and inspects
// the latest SyncRun row for froiz to estimate real-world yield.
//
// Froiz is the 5th distinct adapter pattern discovered:
// sitemap+html-cards — sitemap XML → filter folhas de categoria (lvl3+4) →
// fetch HTML category pages → scrape `.product-grid .product` DOM cards.
// Unlike Eroski S220 (data-metrics ecommerce JSON) and Aldi S219 (JSON-LD
// on detail pages), Froiz tem só DOM cards puros — sem IDs estáveis, sem
// EAN, sem structured data. Match no DB via normalizedName (S116 auto).
//
// No external HTTP calls — relies on the static adapter source + DB.
//
// Usage:
//   node scripts/audit-froiz-adapter.mjs [--out=path.json] [--skip-db]

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
    'froiz.adapter.ts',
  );
  return { adapterPath, src: readFileSync(adapterPath, 'utf8') };
}

function classify(src) {
  const seedMatch = src.match(/const\s+SEED_QUERIES\s*=\s*\[([\s\S]*?)\];/);
  const sitemapHint = /SITEMAP_URL|sitemap\.xml/i.test(src);
  const jsonLdHint = /application\/ld\+json|@type.*Product/i.test(src);
  const dataMetricsHint = /data-metrics|product-title-link/i.test(src);
  const treeHint = /categories\/|category[-_]tree|walkCategor/i.test(src);
  const cardScrapeHint = /\.product-grid|\.product\b/i.test(src) && /cheerio/i.test(src);
  const scrapeHint = /cheerio|parse5/i.test(src);

  if (sitemapHint && dataMetricsHint) {
    return { pattern: 'sitemap+html-data-metrics', queries: [] };
  }
  if (sitemapHint && jsonLdHint) return { pattern: 'sitemap+jsonld', queries: [] };
  if (sitemapHint && cardScrapeHint) {
    return { pattern: 'sitemap+html-cards', queries: [] };
  }
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
  const defaultMax =
    src.match(/DEFAULT_MAX_CATEGORIES\s*=\s*(\d+)/)?.[1] ?? null;
  const envName =
    src.match(/process\.env\.(FROIZ_[A-Z_]+)/)?.[1] ?? null;
  const leafDepths = src.match(/LEAF_DEPTHS\s*=\s*new Set\(\[([^\]]+)\]\)/)?.[1] ?? null;
  return { defaultMax, envName, leafDepths };
}

async function dbStats() {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const sm = await prisma.supermarket.findUnique({
        where: { slug: 'froiz' },
      });
      if (!sm) return { ok: true, note: 'no froiz supermarket row' };

      const priceCount = await prisma.productPrice.count({
        where: { supermarketId: sm.id },
      });

      const latestSync = await prisma.syncRun
        .findFirst({
          where: { supermarketSlug: 'froiz' },
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

  // Live-probed 2026-11-27 contra https://supermercado.froiz.com/sitemap.xml:
  //   totalLocs:       8287
  //   productLocs:     7105  (/product/ URLs — não usadas atualmente)
  //   categoryLocs:    1182
  //   byDepth cats:    {0:1, 1:25, 2:113, 3:558, 4:485}
  //   depth 3+4 leaves: 1043 (filtro LEAF_DEPTHS atual)
  //
  // Sample fetches (Cheerio `.product-grid .product`):
  //   lvl3 /alimentacion/pastas-y-masas/pasta-para-sopa-fideos-y-fideua → 14 cards
  //   lvl3 /carniceria/ternera-y-vaca/vaca → 3 cards
  //   lvl4 /alimentacion/cafes-e-infusiones/cafes-y-cereales-solubles/grano-mezcla → 3 cards
  //   avg: ~6.7 cards/leaf (sample 3 — alta variância por categoria)
  //
  // Conclusão: Froiz = 5º pattern distinto (sitemap+html-cards). Cap atual 60
  // × 6.7 avg = ~400 teórico. DB prod ~366 → ~92% coverage do cap. Raise
  // cap 60 → 300 (pattern S220 Eroski) destrava ~2010 produtos teórico
  // (300 × 6.7). Raise 300 → 600 chegaria ~4020 produtos (56% do sitemap
  // lvl3+4 pool). Sem rate-limit/WAF aparente durante probe; polite-fetch
  // 1-3s jitter mantém educado.
  const sitemapTotalLocs = 8287;
  const sitemapProductLocs = 7105;
  const sitemapCategoryLocs = 1182;
  const sitemapLeaf3Plus4 = 1043;
  const sitemapLeaf3 = 558;
  const sitemapLeaf4 = 485;
  const avgProductsPerLeaf = 6.7;

  const defaultMax = caps.defaultMax ? Number(caps.defaultMax) : null;
  const effectiveLeafPool = sitemapLeaf3Plus4;
  const theoreticalCeiling =
    defaultMax != null
      ? Math.min(defaultMax, effectiveLeafPool) * avgProductsPerLeaf
      : effectiveLeafPool * avgProductsPerLeaf;

  console.log(`[audit-froiz] adapter: ${adapterPath}`);
  console.log(`[audit-froiz] pattern: ${pattern}`);
  console.log(`[audit-froiz] seed queries: ${queries.length}`);
  console.log(
    `[audit-froiz] caps: defaultMax=${caps.defaultMax ?? '?'} env=${caps.envName ?? '?'} leafDepths=${caps.leafDepths ?? '?'}`,
  );

  const db = skipDb ? { ok: false, error: 'skipped' } : await dbStats();

  console.log('');
  console.log('[audit-froiz] SUMMARY');
  console.log(`  pattern:                 ${pattern}`);
  console.log(`  sitemap totalLocs:       ${sitemapTotalLocs}`);
  console.log(`  sitemap productLocs:     ${sitemapProductLocs} (unused)`);
  console.log(`  sitemap categoryLocs:    ${sitemapCategoryLocs}`);
  console.log(`  leaves lvl3:             ${sitemapLeaf3}`);
  console.log(`  leaves lvl4:             ${sitemapLeaf4}`);
  console.log(`  effective leaf pool:     ${effectiveLeafPool} (lvl3+4)`);
  console.log(`  default max categories:  ${caps.defaultMax ?? 'none'}`);
  console.log(`  avg products / leaf:     ~${avgProductsPerLeaf} (sampled)`);
  console.log(`  effective ceiling:       ~${Math.round(theoreticalCeiling)}`);

  if (db.ok) {
    console.log(`  DB productPrices (fro):  ${db.productPrices ?? 'n/a'}`);
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
        `  coverage estimate:       ${cov.toFixed(1)}% (DB / effective ceiling)`,
      );
    }
    const fullCatalog = sitemapLeaf3Plus4 * avgProductsPerLeaf;
    if (db.productPrices) {
      const potential = (db.productPrices / fullCatalog) * 100;
      console.log(
        `  full-catalog coverage:   ${potential.toFixed(1)}% (DB / leaf3+4 × avg)`,
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
    sitemapTotalLocs,
    sitemapProductLocs,
    sitemapCategoryLocs,
    sitemapLeaf3,
    sitemapLeaf4,
    sitemapLeaf3Plus4,
    avgProductsPerLeaf,
    effectiveLeafPool,
    theoreticalCeiling: Math.round(theoreticalCeiling),
    db,
    generatedAt: new Date().toISOString(),
  };

  if (out) {
    writeFileSync(out, JSON.stringify(report, null, 2));
    console.log(`[audit-froiz] wrote ${out}`);
  }
}

main().catch((err) => {
  console.error('[audit-froiz] fatal:', err);
  process.exit(1);
});
