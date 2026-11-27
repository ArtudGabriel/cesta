#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Sprint 232 G3 cluster-based (ADR 0040) — matching cross-mercado SEM
 * pré-requisito EAN.
 *
 * Fix design flaw S229 G3: `match-trigram.mjs` exigia canonicais com
 * `ean IS NOT NULL` pra bater contra duplicates `ean IS NULL`. Mas G3
 * existe exatamente pra adapters que NÃO expõem EAN (DIA/LIDL/Eroski/
 * Froiz · ADR 0038). Resultado em prod: 0 candidatos porque 0 canonicais
 * com EAN. Bug.
 *
 * S232 approach: comparar produtos ENTRE mercados diretamente, formar
 * clusters N-way via union-find, eleger 1 canonical por cluster.
 *
 * Gate STRICT (reusa parseSize/sizeMatch S231):
 *   - word_similarity(normalized_name A, normalized_name B) >= HIGH (0.75)
 *   - brand_match (LOWER igual, ambos not null)
 *   - size_match (parseSize igualdade estrita; sem size → NÃO bate)
 *
 * Eleição canonical por cluster (desempate em ordem):
 *   1. has_ean DESC (prefere canonical com EAN se houver no cluster)
 *   2. createdAt ASC (produto "mais velho" = seed original)
 *   3. id ASC (determinístico)
 *
 * Apply:
 *   - Pra cada cluster com N >= 2 membros, o eleito fica canonical
 *     (canonicalProductId NULL); todos os outros recebem
 *     canonicalProductId = canonical.id.
 *   - UPDATE idempotente filtra `canonicalProductId IS NULL` →
 *     re-apply não muda nada.
 *
 * Boss guards (herdados S228 G2 + S229 G3 + S231):
 *  1. Aditivo — reusa schema S228 G2 (canonicalProductId FK). Zero migration.
 *  2. LIGA, não apaga — apenas UPDATE canonicalProductId. Preserva FKs
 *     favorites/lists/alerts/reviews.
 *  3. PITR Neon antes --apply (reminder impresso).
 *  4. Dry-run default + --apply opt-in idempotente (filtro + union-find
 *     determinístico).
 *  5. Rollback: UPDATE products SET canonical_product_id = NULL WHERE
 *     canonical_product_id IS NOT NULL AND updated_at > '<timestamp>'
 *     OR PITR Neon branch restore.
 *  6. Strict marca + tamanho S231 (parseSize/sizeMatch importados).
 *  7. Amostra 30 clusters QA pré-apply (SAMPLE_CLUSTERS env).
 *
 * Uso:
 *   node scripts/match-cluster.mjs                       # dry-run
 *   node scripts/match-cluster.mjs --apply               # grava
 *   node scripts/match-cluster.mjs --high=0.8 --limit=1000
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
  const getFlag = (name, def) => {
    const prefix = `--${name}=`;
    const found = args.find((a) => a.startsWith(prefix));
    if (!found) return def;
    const parsed = parseFloat(found.slice(prefix.length));
    return Number.isFinite(parsed) ? parsed : def;
  };
  return {
    apply: args.includes('--apply'),
    high: getFlag('high', 0.75),
    limit: Math.round(getFlag('limit', 500)),
  };
}

// ────────────────────────────────────────────────────────────
// Size parser / match (herdado S231 · idêntico pra consistência)
// ────────────────────────────────────────────────────────────

export function parseSize(text) {
  if (!text || typeof text !== 'string') return null;
  const s = text.toLowerCase();
  const packMatch = s.match(/(?:pack\s*|x\s*)(\d+)\b/);
  if (packMatch) {
    const n = parseInt(packMatch[1], 10);
    if (Number.isFinite(n) && n > 1) return { value: n, unit: 'pack' };
  }
  const mlMatch = s.match(/(\d+(?:[.,]\d+)?)\s*ml\b/);
  if (mlMatch) {
    const v = parseFloat(mlMatch[1].replace(',', '.'));
    if (Number.isFinite(v) && v > 0) return { value: Math.round(v), unit: 'ml' };
  }
  const lMatch = s.match(/(\d+(?:[.,]\d+)?)\s*l\b(?!\w)/);
  if (lMatch && !/ml\b/.test(s)) {
    const v = parseFloat(lMatch[1].replace(',', '.'));
    if (Number.isFinite(v) && v > 0) return { value: Math.round(v * 1000), unit: 'ml' };
  }
  const kgMatch = s.match(/(\d+(?:[.,]\d+)?)\s*kg\b/);
  if (kgMatch) {
    const v = parseFloat(kgMatch[1].replace(',', '.'));
    if (Number.isFinite(v) && v > 0) return { value: Math.round(v * 1000), unit: 'g' };
  }
  const gMatch = s.match(/(\d+(?:[.,]\d+)?)\s*gr?\b/);
  if (gMatch && !/kg\b/.test(s)) {
    const v = parseFloat(gMatch[1].replace(',', '.'));
    if (Number.isFinite(v) && v > 0) return { value: Math.round(v), unit: 'g' };
  }
  return null;
}

export function sizeMatch(a, b) {
  const sa = parseSize(a);
  const sb = parseSize(b);
  if (!sa || !sb) return false;
  return sa.unit === sb.unit && sa.value === sb.value;
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
    // path compression
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
// Core
// ────────────────────────────────────────────────────────────

/**
 * Pra cada produto base (até LIMIT), busca candidates cross-mercado com
 * mesmo brand (lowercase) + word_similarity >= HIGH. SQL filtra pg_trgm
 * primeiro (GIN acelera `%`), depois threshold exato. Cross-mercado:
 * p_b.id em supermarkets DIFERENTE de p_a.
 */
async function findCrossMarketCandidates(prisma, { high, limit }) {
  return prisma.$queryRaw`
    WITH base AS (
      SELECT p.id, p.name, p.brand, p.normalized_name, p.ean, p.created_at,
             pp.supermarket_id
      FROM products p
      JOIN product_prices pp ON pp.product_id = p.id
      WHERE p.deleted_at IS NULL
        AND p.canonical_product_id IS NULL
      ORDER BY p.created_at ASC, p.id ASC
      LIMIT ${limit}
    )
    SELECT
      d.id AS a_id,
      d.name AS a_name,
      d.brand AS a_brand,
      d.ean AS a_ean,
      d.created_at AS a_created_at,
      c.id AS b_id,
      c.name AS b_name,
      c.brand AS b_brand,
      c.ean AS b_ean,
      c.created_at AS b_created_at,
      word_similarity(d.normalized_name, c.normalized_name) AS score
    FROM base d
    JOIN products c ON c.deleted_at IS NULL
      AND c.canonical_product_id IS NULL
      AND c.id > d.id
      AND d.brand IS NOT NULL
      AND c.brand IS NOT NULL
      AND LOWER(d.brand) = LOWER(c.brand)
      AND word_similarity(d.normalized_name, c.normalized_name) >= ${high}::real
    WHERE EXISTS (
      SELECT 1 FROM product_prices pp2
      WHERE pp2.product_id = c.id
        AND pp2.supermarket_id != d.supermarket_id
    )
    ORDER BY d.id, c.id
  `;
}

/**
 * Determina qual produto do cluster vira canonical.
 * Ordem: has_ean DESC, createdAt ASC, id ASC.
 */
function electCanonical(members) {
  const sorted = [...members].sort((a, b) => {
    const eanA = a.ean ? 1 : 0;
    const eanB = b.ean ? 1 : 0;
    if (eanA !== eanB) return eanB - eanA; // has_ean DESC
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    if (ta !== tb) return ta - tb; // createdAt ASC
    return a.id.localeCompare(b.id); // id ASC
  });
  return sorted[0];
}

async function main() {
  const { apply, high, limit } = parseArgs();
  process.env.DATABASE_URL = loadDatabaseUrl();
  const prisma = new PrismaClient();

  try {
    console.log('='.repeat(72));
    console.log('Sprint 232 G3 cluster — match-cluster');
    console.log('='.repeat(72));
    console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
    console.log(`Threshold: high=${high} (brand + size + similarity STRICT)`);
    console.log(`Limit base produtos: ${limit}`);
    if (apply) {
      const nowUtc = new Date().toISOString();
      console.log('\n⚠️  Boss guard: snapshot Neon ANTES de continuar.');
      console.log(`   https://console.neon.tech/app/projects → create branch`);
      console.log(`   PITR timestamp (cole no PR): ${nowUtc}`);
      console.log(`   Rollback SQL: UPDATE products SET canonical_product_id = NULL`);
      console.log(`     WHERE canonical_product_id IS NOT NULL AND updated_at > '${nowUtc}';`);
    }

    console.log('\nBuscando pares candidates (brand + sim >= HIGH, cross-mercado)...');
    const rawPairs = await findCrossMarketCandidates(prisma, { high, limit });
    console.log(`Pares candidates (brand ✓ · sim >= ${high} · cross-mercado): ${rawPairs.length}`);

    // Filtro size_match (JS).
    const strictPairs = rawPairs.filter((p) => sizeMatch(p.a_name, p.b_name));
    console.log(`Pares strict (adiciona size ✓): ${strictPairs.length}`);

    // Union-find.
    const uf = new UnionFind();
    const products = new Map();
    for (const p of strictPairs) {
      products.set(p.a_id, {
        id: p.a_id,
        name: p.a_name,
        brand: p.a_brand,
        ean: p.a_ean,
        created_at: p.a_created_at,
      });
      products.set(p.b_id, {
        id: p.b_id,
        name: p.b_name,
        brand: p.b_brand,
        ean: p.b_ean,
        created_at: p.b_created_at,
      });
      uf.union(p.a_id, p.b_id);
    }

    const components = uf.components();
    const clusters = [];
    for (const [root, nodeIds] of components) {
      if (nodeIds.length < 2) continue;
      const members = nodeIds.map((id) => products.get(id)).filter(Boolean);
      const canonical = electCanonical(members);
      const duplicates = members.filter((m) => m.id !== canonical.id);
      clusters.push({ canonical, duplicates, size: members.length });
      void root;
    }
    clusters.sort((a, b) => b.size - a.size);

    const totalDuplicates = clusters.reduce((s, c) => s + c.duplicates.length, 0);
    console.log(`\nClusters N>=2: ${clusters.length}`);
    console.log(`Duplicates a linkar: ${totalDuplicates}`);
    console.log(`Avg cluster size: ${clusters.length > 0 ? (totalDuplicates / clusters.length + 1).toFixed(2) : '0'}`);

    // Histogram.
    const histo = new Map();
    for (const c of clusters) {
      histo.set(c.size, (histo.get(c.size) ?? 0) + 1);
    }
    console.log('\nHistogram size → #clusters:');
    for (const size of [...histo.keys()].sort((a, b) => a - b)) {
      console.log(`  size=${size}: ${histo.get(size)}`);
    }

    const SAMPLE = parseInt(process.env.SAMPLE_CLUSTERS ?? '30', 10);
    console.log(`\nSample clusters (${Math.min(SAMPLE, clusters.length)}/${clusters.length}):`);
    console.log('-'.repeat(72));
    for (const c of clusters.slice(0, SAMPLE)) {
      const dupSize = parseSize(c.canonical.name);
      const sz = dupSize ? `${dupSize.value}${dupSize.unit}` : '∅';
      console.log(
        `  cluster size=${c.size} canonical[ean=${c.canonical.ean ?? '∅'}]: "${c.canonical.name.slice(0, 48)}" [${c.canonical.brand ?? '∅'}|${sz}]`,
      );
      for (const d of c.duplicates) {
        console.log(`     → "${d.name.slice(0, 48)}" [${d.brand ?? '∅'}|${parseSize(d.name)?.value ?? '?'}${parseSize(d.name)?.unit ?? ''}] id=${d.id.slice(0, 8)}`);
      }
    }

    if (!apply) {
      console.log('\n--dry-run: Nenhuma mudança gravada. Para aplicar: --apply');
      return;
    }

    // APPLY: UPDATE idempotente por cluster.
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
    console.log('   Próximo: node scripts/audit-trigram-match.mjs (audit cluster size via canonicalProductId NOT NULL).');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
