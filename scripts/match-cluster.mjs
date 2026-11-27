#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Sprint 232 G3 cluster-based (ADR 0040) · S234 recall fix (ADR 0041).
 *
 * Matching cross-mercado SEM pré-requisito EAN. Full pipeline:
 *   1. SQL base: para cada Product (limit N), lista supermarkets via
 *      array_agg. Cross-mercado = super_ids DISJUNTOS (sem overlap).
 *   2. SQL candidate join: pares (a,b) com word_similarity(a.normalized_name,
 *      b.normalized_name) >= LOW_SIM (SQL pré-filter via pg_trgm GIN).
 *   3. JS brand filter: brand_eff = row.brand ?? extractBrand(row.name) via
 *      dicionário S234. Ambos lados devem ter brand_eff igual.
 *   4. JS size filter: parseSize/sizeMatch S234 expanded (multi-pack, 1,25L).
 *   5. JS token Jaccard: normalizeNameForMatch remove brand+size+genéricas +
 *      acentos; Jaccard sobre tokens >= TOKEN_MIN. Boost final que preserva
 *      recall em casos onde pg_trgm sofre com nomes longos.
 *   6. Union-find cluster + eleição canonical (has_ean DESC, createdAt ASC,
 *      id ASC).
 *   7. Apply idempotente UPDATE canonicalProductId.
 *
 * Boss guards (herdadas G2+G3+S231+S234): migration aditiva (nenhuma neste
 * script), LIGA não apaga (UPDATE apenas), PITR reminder, dry-run default,
 * amostra 30 QA, strict marca+size, G0 archive separado no PR.
 *
 * Uso:
 *   node scripts/match-cluster.mjs                       # dry-run
 *   node scripts/match-cluster.mjs --apply               # grava
 *   node scripts/match-cluster.mjs --low-sim=0.4 --token-min=0.6
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import {
  extractBrand,
  parseSize,
  sizeMatchEff,
  effectiveSize,
  normalizeNameForMatch,
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

function parseArgs() {
  const args = process.argv.slice(2);
  const getFlag = (name, def) => {
    const prefix = `--${name}=`;
    const found = args.find((a) => a.startsWith(prefix));
    if (!found) return def;
    const parsed = parseFloat(found.slice(prefix.length));
    return Number.isFinite(parsed) ? parsed : def;
  };
  return {
    apply: args.includes('--apply'),
    lowSim: getFlag('low-sim', 0.4),
    tokenMin: getFlag('token-min', 0.6),
    limit: Math.round(getFlag('limit', 500)),
  };
}

// ────────────────────────────────────────────────────────────
// Union-Find (DSU)
// ────────────────────────────────────────────────────────────

class UnionFind {
  constructor() {
    this.parent = new Map();
    this.rank = new Map();
  }
  add(x) {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
  }
  find(x) {
    this.add(x);
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root);
    let cur = x;
    while (this.parent.get(cur) !== root) {
      const next = this.parent.get(cur);
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }
  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    const raRank = this.rank.get(ra);
    const rbRank = this.rank.get(rb);
    if (raRank < rbRank) this.parent.set(ra, rb);
    else if (raRank > rbRank) this.parent.set(rb, ra);
    else {
      this.parent.set(rb, ra);
      this.rank.set(ra, raRank + 1);
    }
  }
  components() {
    const groups = new Map();
    for (const node of this.parent.keys()) {
      const root = this.find(node);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(node);
    }
    return groups;
  }
}

// ────────────────────────────────────────────────────────────
// Jaccard token sim
// ────────────────────────────────────────────────────────────

function tokenJaccard(a, b) {
  const ta = new Set((a ?? '').split(/\s+/).filter(Boolean));
  const tb = new Set((b ?? '').split(/\s+/).filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = ta.size + tb.size - inter;
  return union > 0 ? inter / union : 0;
}

// ────────────────────────────────────────────────────────────
// SQL
// ────────────────────────────────────────────────────────────

/**
 * Detecta se migration S234 (ProductPrice.deleted_at) foi aplicada no DB.
 * Pré-migration: filtro `pp.deleted_at IS NULL` quebra; usa variant sem.
 */
async function hasProductPriceDeletedAt(prisma) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_prices' AND column_name = 'deleted_at'
    LIMIT 1
  `);
  return rows.length > 0;
}

/**
 * Busca pares cross-mercado via pg_trgm pré-filtro + DISJOINT super arrays.
 * Nota: respeita ProductPrice.deleted_at IS NULL (S234 soft-delete seed)
 * quando a coluna existe (pós-migration).
 */
async function findCrossMarketPairs(prisma, { lowSim, limit, hasSoftDelete }) {
  const softDeleteFilter = hasSoftDelete ? 'AND pp.deleted_at IS NULL' : '';
  return prisma.$queryRawUnsafe(
    `
    WITH product_supers AS (
      SELECT p.id, p.name, p.brand, p.normalized_name, p.ean, p.created_at,
             p.package_size, p.package_unit,
             array_agg(DISTINCT pp.supermarket_id) AS super_ids
      FROM products p
      JOIN product_prices pp ON pp.product_id = p.id ${softDeleteFilter}
      WHERE p.deleted_at IS NULL
        AND p.canonical_product_id IS NULL
      GROUP BY p.id, p.name, p.brand, p.normalized_name, p.ean, p.created_at,
               p.package_size, p.package_unit
    ),
    base AS (
      SELECT * FROM product_supers
      ORDER BY created_at ASC, id ASC
      LIMIT $1
    )
    SELECT
      d.id AS a_id, d.name AS a_name, d.brand AS a_brand, d.ean AS a_ean,
        d.created_at AS a_created_at, d.normalized_name AS a_normalized,
        d.package_size AS a_package_size, d.package_unit AS a_package_unit,
      c.id AS b_id, c.name AS b_name, c.brand AS b_brand, c.ean AS b_ean,
        c.created_at AS b_created_at, c.normalized_name AS b_normalized,
        c.package_size AS b_package_size, c.package_unit AS b_package_unit,
      word_similarity(d.normalized_name, c.normalized_name) AS sql_sim
    FROM base d
    JOIN product_supers c ON c.id > d.id
      AND NOT (d.super_ids && c.super_ids)
      AND word_similarity(d.normalized_name, c.normalized_name) >= $2::real
    ORDER BY d.id, c.id
    `,
    limit,
    lowSim,
  );
}

function electCanonical(members) {
  const sorted = [...members].sort((a, b) => {
    const eanA = a.ean ? 1 : 0;
    const eanB = b.ean ? 1 : 0;
    if (eanA !== eanB) return eanB - eanA;
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });
  return sorted[0];
}

// ────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────

async function main() {
  const { apply, lowSim, tokenMin, limit } = parseArgs();
  process.env.DATABASE_URL = loadDatabaseUrl();
  const prisma = new PrismaClient();

  try {
    console.log('='.repeat(72));
    console.log('Sprint 232 G3 cluster · S234 recall fix — match-cluster');
    console.log('='.repeat(72));
    console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
    console.log(`Thresholds: low_sim=${lowSim} token_min=${tokenMin}`);
    console.log(`Limit base produtos: ${limit}`);
    if (apply) {
      const nowUtc = new Date().toISOString();
      console.log('\n⚠️  Boss guard: snapshot Neon ANTES de continuar.');
      console.log(`   PITR timestamp (cole no PR): ${nowUtc}`);
      console.log(`   Rollback SQL: UPDATE products SET canonical_product_id = NULL`);
      console.log(`     WHERE canonical_product_id IS NOT NULL AND updated_at > '${nowUtc}';`);
    }

    const hasSoftDelete = await hasProductPriceDeletedAt(prisma);
    console.log(`\n[0/5] Schema probe: ProductPrice.deleted_at ${hasSoftDelete ? '✓ presente' : '✗ ausente (pre-migration)'}`);

    console.log('\n[1/5] SQL fetch pares cross-mercado (DISJOINT supers · sim >= lowSim)...');
    const rawPairs = await findCrossMarketPairs(prisma, { lowSim, limit, hasSoftDelete });
    console.log(`SQL pairs: ${rawPairs.length}`);

    // Fase 2: brand match com extração dicionário.
    console.log('[2/5] JS brand filter (dicionário extractBrand pra NULLs)...');
    const brandPairs = [];
    for (const p of rawPairs) {
      const ba = p.a_brand ?? extractBrand(p.a_name);
      const bb = p.b_brand ?? extractBrand(p.b_name);
      if (!ba || !bb) continue;
      if (ba.toLowerCase() !== bb.toLowerCase()) continue;
      brandPairs.push({ ...p, a_brand_eff: ba, b_brand_eff: bb });
    }
    console.log(`Brand match: ${brandPairs.length}`);

    // Fase 3: size strict (parseSize S234 expanded + packageSize fallback).
    console.log('[3/5] JS size strict (parseSize/sizeMatchEff S234)...');
    const sizePairs = brandPairs.filter((p) =>
      sizeMatchEff(
        { name: p.a_name, packageSize: p.a_package_size, packageUnit: p.a_package_unit },
        { name: p.b_name, packageSize: p.b_package_size, packageUnit: p.b_package_unit },
      ),
    );
    console.log(`Size match: ${sizePairs.length}`);

    if (process.env.DEBUG_SIZE && brandPairs.length > 0 && sizePairs.length < 20) {
      console.log('\nDEBUG_SIZE sample brandPairs rejected por size:');
      for (const p of brandPairs.slice(0, 15)) {
        const sa = effectiveSize(p.a_name, p.a_package_size, p.a_package_unit);
        const sb = effectiveSize(p.b_name, p.b_package_size, p.b_package_unit);
        const ok =
          sa && sb && sa.unit === sb.unit && sa.value === sb.value && sa.pack === sb.pack
            ? '✓'
            : '×';
        console.log(
          `  ${ok} "${p.a_name.slice(0, 40)}" pkg=${p.a_package_size}/${p.a_package_unit} [${JSON.stringify(sa)}]`,
        );
        console.log(
          `    → "${p.b_name.slice(0, 40)}" pkg=${p.b_package_size}/${p.b_package_unit} [${JSON.stringify(sb)}]`,
        );
      }
    }

    // Fase 4: token Jaccard sobre nome normalizado.
    console.log('[4/5] JS token Jaccard (normalizeNameForMatch · Jaccard >= tokenMin)...');
    const tokenPairs = sizePairs
      .map((p) => {
        const na = normalizeNameForMatch(p.a_name, p.a_brand_eff);
        const nb = normalizeNameForMatch(p.b_name, p.b_brand_eff);
        const jacc = tokenJaccard(na, nb);
        return { ...p, a_norm: na, b_norm: nb, token_jacc: jacc };
      })
      .filter((p) => p.token_jacc >= tokenMin);
    console.log(`Token Jaccard >= ${tokenMin}: ${tokenPairs.length}`);

    // Fase 5: union-find cluster.
    console.log('[5/5] Union-find cluster + eleição canonical...');
    const uf = new UnionFind();
    const products = new Map();
    for (const p of tokenPairs) {
      const recA = {
        id: p.a_id,
        name: p.a_name,
        brand: p.a_brand_eff,
        ean: p.a_ean,
        created_at: p.a_created_at,
        packageSize: p.a_package_size,
        packageUnit: p.a_package_unit,
      };
      const recB = {
        id: p.b_id,
        name: p.b_name,
        brand: p.b_brand_eff,
        ean: p.b_ean,
        created_at: p.b_created_at,
        packageSize: p.b_package_size,
        packageUnit: p.b_package_unit,
      };
      products.set(p.a_id, recA);
      products.set(p.b_id, recB);
      uf.union(p.a_id, p.b_id);
    }

    const components = uf.components();
    const clusters = [];
    for (const [, nodeIds] of components) {
      if (nodeIds.length < 2) continue;
      const members = nodeIds.map((id) => products.get(id)).filter(Boolean);
      const canonical = electCanonical(members);
      const duplicates = members.filter((m) => m.id !== canonical.id);
      clusters.push({ canonical, duplicates, size: members.length });
    }
    clusters.sort((a, b) => b.size - a.size);

    const totalDuplicates = clusters.reduce((s, c) => s + c.duplicates.length, 0);
    console.log(`\nClusters N>=2: ${clusters.length}`);
    console.log(`Duplicates a linkar: ${totalDuplicates}`);
    if (clusters.length > 0) {
      const avg = totalDuplicates / clusters.length + 1;
      console.log(`Avg cluster size: ${avg.toFixed(2)}`);
    }

    // Histogram
    const histo = new Map();
    for (const c of clusters) histo.set(c.size, (histo.get(c.size) ?? 0) + 1);
    if (histo.size > 0) {
      console.log('\nHistogram size → #clusters:');
      for (const size of [...histo.keys()].sort((a, b) => a - b)) {
        console.log(`  size=${size}: ${histo.get(size)}`);
      }
    }

    // Sample QA
    const SAMPLE = parseInt(process.env.SAMPLE_CLUSTERS ?? '30', 10);
    console.log(`\nSample clusters (${Math.min(SAMPLE, clusters.length)}/${clusters.length}):`);
    console.log('-'.repeat(72));
    for (const c of clusters.slice(0, SAMPLE)) {
      const sz = effectiveSize(c.canonical.name, c.canonical.packageSize, c.canonical.packageUnit);
      const szStr = sz ? `${sz.value}${sz.unit}${sz.pack > 1 ? `×${sz.pack}` : ''}` : '∅';
      console.log(
        `  cluster=${c.size} canonical[ean=${c.canonical.ean ?? '∅'}]: "${c.canonical.name.slice(0, 48)}" [${c.canonical.brand ?? '∅'}|${szStr}]`,
      );
      for (const d of c.duplicates) {
        const dsz = effectiveSize(d.name, d.packageSize, d.packageUnit);
        const dszStr = dsz ? `${dsz.value}${dsz.unit}${dsz.pack > 1 ? `×${dsz.pack}` : ''}` : '∅';
        console.log(`     → "${d.name.slice(0, 48)}" [${d.brand ?? '∅'}|${dszStr}]`);
      }
    }

    if (!apply) {
      console.log('\n--dry-run: Nenhuma mudança gravada. Para aplicar: --apply');
      return;
    }

    // APPLY
    let linked = 0;
    for (const cluster of clusters) {
      const duplicateIds = cluster.duplicates.map((d) => d.id);
      if (duplicateIds.length === 0) continue;
      const r = await prisma.product.updateMany({
        where: {
          id: { in: duplicateIds },
          canonicalProductId: null,
          deletedAt: null,
        },
        data: { canonicalProductId: cluster.canonical.id },
      });
      linked += r.count;
    }
    console.log(`\n✅ Apply concluído. ${linked} duplicates linkados em ${clusters.length} clusters.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
