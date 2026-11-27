#!/usr/bin/env node
// Sprint 220 — audit Eroski adapter catalog coverage.
//
// Classifies the adapter pattern (SEED_QUERIES vs category-tree vs
// sitemap+JSON-LD vs sitemap+html-data-metrics), counts distinct DB
// products for supermarket.slug='eroski', and inspects the latest SyncRun
// row for eroski to estimate real-world yield.
//
// Eroski is the 4th distinct adapter pattern discovered: sitemap XML →
// filter folhas de categoria (lvl3+) → fetch HTML category pages →
// scrape `data-metrics` attribute (schema.org-ish ecommerce JSON). Unlike
// Aldi S219 (sitemap + JSON-LD on detail pages), Eroski never hits
// product-detail pages — the list page already has structured data.
//
// No external HTTP calls — relies on the static adapter source + DB.
//
// Usage:
//   node scripts/audit-eroski-adapter.mjs [--out=path.json] [--skip-db]

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
    'eroski.adapter.ts',
  );
  return { adapterPath, src: readFileSync(adapterPath, 'utf8') };
}

function classify(src) {
  const seedMatch = src.match(/const\s+SEED_QUERIES\s*=\s*\[([\s\S]*?)\];/);
  const sitemapHint = /SITEMAP_URL|sitemap\.xml/i.test(src);
  const jsonLdHint = /application\/ld\+json|@type.*Product/i.test(src);
  const dataMetricsHint = /data-metrics|product-title-link/i.test(src);
  const treeHint = /categories\/|category[-_]tree|walkCategor/i.test(src);
  const scrapeHint = /cheerio|parse5/i.test(src);

  if (sitemapHint && dataMetricsHint) {
    return { pattern: 'sitemap+html-data-metrics', queries: [] };
  }
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
  const defaultMax =
    src.match(/DEFAULT_MAX_CATEGORIES\s*=\s*(\d+)/)?.[1] ?? null;
  const envName =
    src.match(/process\.env\.(EROSKI_[A-Z_]+)/)?.[1] ?? null;
  const lvlFilter = src.match(/segments\.length\s*>=?\s*(\d+)/)?.[1] ?? null;
  return { defaultMax, envName, lvlFilter };
}

async function dbStats() {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const sm = await prisma.supermarket.findUnique({
        where: { slug: 'eroski' },
      });
      if (!sm) return { ok: true, note: 'no eroski supermarket row' };

      const priceCount = await prisma.productPrice.count({
        where: { supermarketId: sm.id },
      });

      const latestSync = await prisma.syncRun
        .findFirst({
          where: { supermarketSlug: 'eroski' },
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

  // Live-probed 2026-11-27 contra https://supermercado.eroski.es/sitemap.xml:
  //   totalLocs:          1819  (categorias + estáticas)
  //   /es/supermercado/ URLs com segments.length >= 2: 1613 (filtro atual)
  //   mesmas com segments.length >= 3:                 1317 (folhas reais)
  //   distribuição por nível: {1:200, 2:296, 3:946, 4:371}
  //
  // Sample fetches:
  //   lvl 2 /2059698-frescos/2059811-carniceria/  →  0 tiles
  //   lvl 2 /2060037-bodega/2060038-vinos/        →  0 tiles
  //   lvl 2 /2059698-frescos/2059699-frutas/      → 20 tiles (hub + 1 nivel)
  //   lvl 3 /...2059699-frutas/2059700-naranjas-y-otros-citricos/ → 19 tiles
  //
  // Conclusão: lvl 2 hubs raramente têm products (hub de categoria pai).
  // Lvl 3+ são folhas reais com ~15-20 tiles cada. Filtro >=2 atual pega
  // 1613 URLs mas ~296 delas são puros hubs sem SSR de tiles. Filtro >=3
  // (pattern S220) foca 1317 folhas reais, elimina ruído e melhora yield.
  const sitemapTotalLocs = 1819;
  const sitemapLeafNode2Plus = 1613;
  const sitemapLeafNode3Plus = 1317;
  const avgProductsPerLeaf = 15;

  const defaultMax = caps.defaultMax ? Number(caps.defaultMax) : null;
  const lvlFilter = caps.lvlFilter ? Number(caps.lvlFilter) : 2;
  const effectiveLeafPool =
    lvlFilter >= 3 ? sitemapLeafNode3Plus : sitemapLeafNode2Plus;
  const theoreticalCeiling =
    defaultMax != null
      ? Math.min(defaultMax, effectiveLeafPool) * avgProductsPerLeaf
      : effectiveLeafPool * avgProductsPerLeaf;

  console.log(`[audit-eroski] adapter: ${adapterPath}`);
  console.log(`[audit-eroski] pattern: ${pattern}`);
  console.log(`[audit-eroski] seed queries: ${queries.length}`);
  console.log(
    `[audit-eroski] caps: defaultMax=${caps.defaultMax ?? '?'} env=${caps.envName ?? '?'} lvlFilter=>=${lvlFilter}`,
  );

  const db = skipDb ? { ok: false, error: 'skipped' } : await dbStats();

  console.log('');
  console.log('[audit-eroski] SUMMARY');
  console.log(`  pattern:                 ${pattern}`);
  console.log(`  sitemap totalLocs:       ${sitemapTotalLocs}`);
  console.log(`  leaves (lvl>=2):         ${sitemapLeafNode2Plus}`);
  console.log(`  leaves (lvl>=3):         ${sitemapLeafNode3Plus}`);
  console.log(`  current lvl filter:      >=${lvlFilter}`);
  console.log(`  effective leaf pool:     ${effectiveLeafPool}`);
  console.log(`  default max categories:  ${caps.defaultMax ?? 'none'}`);
  console.log(`  avg products / leaf:     ~${avgProductsPerLeaf} (sampled)`);
  console.log(`  effective ceiling:       ~${theoreticalCeiling}`);

  if (db.ok) {
    console.log(`  DB productPrices (ero):  ${db.productPrices ?? 'n/a'}`);
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
    const fullCatalog = sitemapLeafNode3Plus * avgProductsPerLeaf;
    if (db.productPrices) {
      const potential = (db.productPrices / fullCatalog) * 100;
      console.log(
        `  full-catalog coverage:   ${potential.toFixed(1)}% (DB / lvl3+ × avg)`,
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
    sitemapLeafNode2Plus,
    sitemapLeafNode3Plus,
    avgProductsPerLeaf,
    effectiveLeafPool,
    theoreticalCeiling,
    db,
    generatedAt: new Date().toISOString(),
  };

  if (out) {
    writeFileSync(out, JSON.stringify(report, null, 2));
    console.log(`[audit-eroski] wrote ${out}`);
  }
}

main().catch((err) => {
  console.error('[audit-eroski] fatal:', err);
  process.exit(1);
});
