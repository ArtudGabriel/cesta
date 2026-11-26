#!/usr/bin/env node
// Sprint 217 — audit Mercadona catalog coverage.
//
// Fetches Mercadona live category tree + walks all sub-categories (recursive).
// Reports: total categories visited, depth, product counts per root, and any
// categories whose product arrays exist at depth > 1 (would be MISSED by the
// S216-era flattenProducts which only walks 1 level deep).
//
// Usage:
//   node scripts/audit-mercadona-queries.mjs [--wh=mad1] [--out=path.json]
//
// No DB access. No writes. Safe offline-ish (hits tienda.mercadona.es).

import { writeFileSync } from 'node:fs';

const BASE = 'https://tienda.mercadona.es/api';
const UA =
  'Mozilla/5.0 (compatible; CestaBot/1.0; +https://cesta.app/robots)';

function parseFlags() {
  const args = process.argv.slice(2);
  const wh =
    args.find((a) => a.startsWith('--wh='))?.split('=')[1] ?? 'mad1';
  const out = args.find((a) => a.startsWith('--out='))?.split('=')[1] ?? null;
  return { wh, out };
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function jitter() {
  const ms = 600 + Math.floor(Math.random() * 900);
  await sleep(ms);
}

async function fetchJson(url) {
  await jitter();
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'es-ES,es;q=0.9',
      Referer: 'https://tienda.mercadona.es/',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

function walkDepth(node, depth, stats) {
  stats.visited += 1;
  stats.maxDepth = Math.max(stats.maxDepth, depth);
  const nodeProducts = Array.isArray(node.products) ? node.products.length : 0;
  if (nodeProducts > 0) {
    stats.productCountsByDepth[depth] =
      (stats.productCountsByDepth[depth] ?? 0) + nodeProducts;
    if (depth > 1) {
      stats.deepLeaves.push({
        depth,
        id: node.id,
        name: node.name,
        products: nodeProducts,
      });
    }
  }
  const subs = Array.isArray(node.categories) ? node.categories : [];
  for (const sub of subs) walkDepth(sub, depth + 1, stats);
}

async function main() {
  const { wh, out } = parseFlags();
  console.log(`[audit-mercadona] wh=${wh}`);

  const treeUrl = `${BASE}/v1_1/categories/?lang=es&wh=${encodeURIComponent(wh)}`;
  console.log(`[audit-mercadona] GET ${treeUrl}`);
  const tree = await fetchJson(treeUrl);
  const roots = tree?.results ?? [];
  console.log(`[audit-mercadona] roots=${roots.length}`);

  const report = {
    wh,
    rootCount: roots.length,
    rootNames: roots.map((r) => r.name),
    perRoot: [],
    grand: {
      visited: 0,
      maxDepth: 0,
      totalProducts: 0,
      productCountsByDepth: {},
      deepLeafCount: 0,
    },
  };

  for (const root of roots) {
    const children = Array.isArray(root.categories) ? root.categories : [root];
    const rootStat = {
      id: root.id,
      name: root.name,
      childCount: children.length,
      visited: 0,
      maxDepth: 0,
      totalProducts: 0,
      productCountsByDepth: {},
      deepLeaves: [],
    };

    for (const sub of children) {
      try {
        const detailed = await fetchJson(
          `${BASE}/categories/${sub.id}/?lang=es&wh=${encodeURIComponent(wh)}`,
        );
        walkDepth(detailed, 1, rootStat);
      } catch (err) {
        console.warn(`  cat ${sub.id} (${sub.name}) failed: ${err.message}`);
      }
    }

    rootStat.totalProducts = Object.values(rootStat.productCountsByDepth).reduce(
      (a, b) => a + b,
      0,
    );
    report.perRoot.push(rootStat);
    console.log(
      `  root "${root.name}": visited=${rootStat.visited} products=${rootStat.totalProducts} maxDepth=${rootStat.maxDepth} deepLeaves=${rootStat.deepLeaves.length}`,
    );

    report.grand.visited += rootStat.visited;
    report.grand.maxDepth = Math.max(report.grand.maxDepth, rootStat.maxDepth);
    report.grand.totalProducts += rootStat.totalProducts;
    report.grand.deepLeafCount += rootStat.deepLeaves.length;
    for (const [d, n] of Object.entries(rootStat.productCountsByDepth)) {
      report.grand.productCountsByDepth[d] =
        (report.grand.productCountsByDepth[d] ?? 0) + n;
    }
  }

  const depth1 = report.grand.productCountsByDepth['1'] ?? 0;
  const deeper = report.grand.totalProducts - depth1;
  const missedPct = report.grand.totalProducts
    ? (deeper / report.grand.totalProducts) * 100
    : 0;

  console.log('');
  console.log('[audit-mercadona] SUMMARY');
  console.log(`  roots visited:   ${report.grand.visited}`);
  console.log(`  max depth:       ${report.grand.maxDepth}`);
  console.log(`  total products:  ${report.grand.totalProducts}`);
  console.log(`  products depth=1:   ${depth1}`);
  console.log(
    `  products depth>=2:  ${deeper}  (${missedPct.toFixed(1)}% missed by old flatten)`,
  );
  console.log(`  deep leaf buckets:  ${report.grand.deepLeafCount}`);
  console.log('');
  console.log('[audit-mercadona] productsByDepth:');
  for (const [d, n] of Object.entries(report.grand.productCountsByDepth).sort(
    (a, b) => Number(a[0]) - Number(b[0]),
  )) {
    console.log(`  depth=${d}: ${n}`);
  }

  if (out) {
    writeFileSync(out, JSON.stringify(report, null, 2));
    console.log(`[audit-mercadona] wrote ${out}`);
  }
}

main().catch((err) => {
  console.error('[audit-mercadona] fatal:', err);
  process.exit(1);
});
