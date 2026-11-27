#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Sprint 235 G3 diagnostic 1 — trace test set Boss directive (2026-11-27).
 *
 * Read-only. Pra cada item do test set (Coca-Cola Zero 2L / Original 2L /
 * Coca-Cola Zero lata 330ml / Milka 125g / Leche entera 1L):
 *   1. Lista produtos em cada mercado que casem com a query básica
 *      (ILIKE no name · marca extraída · size parseado).
 *   2. Para cada par cross-mercado candidato, identifica em QUAL gate
 *      o par morre: brand_match? size_match? jaccard < 0.6?
 *
 * Output tabela trace · uma linha por par com causa+valor. Cola em PR
 * comment pra Boss analisar discrepância spec fixture vs prod.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import {
  extractBrand,
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

// Test set Boss directive. Each case: name_like ILIKE pattern + expected
// brand + expected size (`{value, unit, pack}`).
const TEST_SET = [
  {
    label: 'Coca-Cola Zero 2L',
    namePattern: '%coca%zero%',
    expectedBrand: 'Coca-Cola',
    expectedSize: { value: 2000, unit: 'ml', pack: 1 },
  },
  {
    label: 'Coca-Cola Original 2L',
    namePattern: '%coca%',
    expectedBrand: 'Coca-Cola',
    expectedSize: { value: 2000, unit: 'ml', pack: 1 },
    excludePattern: '%zero%',
  },
  {
    label: 'Coca-Cola Zero lata 330ml',
    namePattern: '%coca%zero%',
    expectedBrand: 'Coca-Cola',
    expectedSize: { value: 330, unit: 'ml', pack: 1 },
  },
  {
    label: 'Milka 125g',
    namePattern: '%milka%',
    expectedBrand: 'Milka',
    expectedSize: { value: 125, unit: 'g', pack: 1 },
  },
  {
    label: 'Leche entera 1L',
    namePattern: '%leche%entera%',
    expectedBrand: null, // própria-marca — qualquer brand
    expectedSize: { value: 1000, unit: 'ml', pack: 1 },
  },
];

function tokenJaccard(a, b) {
  const ta = new Set((a ?? '').split(/\s+/).filter(Boolean));
  const tb = new Set((b ?? '').split(/\s+/).filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = ta.size + tb.size - inter;
  return union > 0 ? inter / union : 0;
}

function sizeEq(a, b) {
  if (!a || !b) return false;
  return a.unit === b.unit && a.value === b.value && a.pack === b.pack;
}

async function fetchCandidates(prisma, tc) {
  const excludeSql = tc.excludePattern
    ? `AND LOWER(p.name) NOT ILIKE $2`
    : '';
  const params = [tc.namePattern];
  if (tc.excludePattern) params.push(tc.excludePattern);
  return prisma.$queryRawUnsafe(
    `
    SELECT
      p.id, p.name, p.brand, p.normalized_name,
      p.package_size, p.package_unit,
      array_agg(DISTINCT s.slug) AS supermarkets
    FROM products p
    JOIN product_prices pp ON pp.product_id = p.id
    JOIN supermarkets s ON s.id = pp.supermarket_id
    WHERE p.deleted_at IS NULL
      AND LOWER(p.name) ILIKE $1
      ${excludeSql}
    GROUP BY p.id, p.name, p.brand, p.normalized_name, p.package_size, p.package_unit
    ORDER BY p.name
    LIMIT 100
    `,
    ...params,
  );
}

function enrich(row) {
  const brandEff = row.brand ?? extractBrand(row.name);
  const sizeEff = effectiveSize(row.name, row.package_size, row.package_unit);
  const normName = normalizeNameForMatch(row.name, brandEff);
  return { ...row, brandEff, sizeEff, normName };
}

function analyzeGate(a, b, expectedBrand) {
  const brandMatch = (a.brandEff ?? '').toLowerCase() === (b.brandEff ?? '').toLowerCase() &&
    a.brandEff != null && b.brandEff != null;
  const sizeMatch = sizeEq(a.sizeEff, b.sizeEff);
  const jacc = tokenJaccard(a.normName, b.normName);
  const jaccMatch = jacc >= 0.6;

  let fails = [];
  if (!brandMatch) {
    fails.push(`brand(a=${a.brandEff ?? '∅'}, b=${b.brandEff ?? '∅'})`);
  }
  if (!sizeMatch) {
    const sa = a.sizeEff ? `${a.sizeEff.value}${a.sizeEff.unit}×${a.sizeEff.pack}` : '∅';
    const sb = b.sizeEff ? `${b.sizeEff.value}${b.sizeEff.unit}×${b.sizeEff.pack}` : '∅';
    fails.push(`size(a=${sa}, b=${sb})`);
  }
  if (!jaccMatch) {
    fails.push(`jacc=${jacc.toFixed(2)}(norm_a="${a.normName}" norm_b="${b.normName}")`);
  }
  return { brandMatch, sizeMatch, jaccMatch, jacc, fails };
}

async function main() {
  process.env.DATABASE_URL = loadDatabaseUrl();
  const prisma = new PrismaClient();

  try {
    console.log('='.repeat(96));
    console.log('Sprint 235 G3 diagnostic 1 — trace test set Boss');
    console.log('='.repeat(96));

    for (const tc of TEST_SET) {
      console.log(`\n### ${tc.label}`);
      console.log('-'.repeat(96));
      const rows = await fetchCandidates(prisma, tc);
      console.log(`Produtos ILIKE "${tc.namePattern}"${tc.excludePattern ? ` excl "${tc.excludePattern}"` : ''}: ${rows.length}`);

      const enriched = rows
        .map(enrich)
        .filter((r) => {
          if (tc.expectedBrand) {
            return (r.brandEff ?? '').toLowerCase() === tc.expectedBrand.toLowerCase();
          }
          return true;
        })
        .filter((r) => sizeEq(r.sizeEff, tc.expectedSize));

      console.log(`Pós-filtro (brand=${tc.expectedBrand ?? 'any'} · size=${tc.expectedSize.value}${tc.expectedSize.unit}×${tc.expectedSize.pack}): ${enriched.length}`);

      if (enriched.length === 0) {
        console.log(`  ⚠  nenhum produto bate expected brand+size. Mostrando TOP 5 nominais pra inspecionar:`);
        for (const r of rows.map(enrich).slice(0, 5)) {
          const sz = r.sizeEff ? `${r.sizeEff.value}${r.sizeEff.unit}×${r.sizeEff.pack}` : '∅';
          console.log(
            `    "${r.name.slice(0, 60)}" [brand=${r.brandEff ?? '∅'}|${sz}|supers=${r.supermarkets.join(',')}]`,
          );
        }
        continue;
      }

      console.log(`\n  Produtos que batem expected:`);
      for (const r of enriched) {
        const sz = r.sizeEff ? `${r.sizeEff.value}${r.sizeEff.unit}×${r.sizeEff.pack}` : '∅';
        console.log(
          `    ${r.id.slice(0, 8)} "${r.name.slice(0, 54)}" [${r.brandEff ?? '∅'}|${sz}|supers=${r.supermarkets.join(',')}] norm="${r.normName}"`,
        );
      }

      // Cross-mercado pair analysis.
      const pairs = [];
      for (let i = 0; i < enriched.length; i += 1) {
        for (let j = i + 1; j < enriched.length; j += 1) {
          const a = enriched[i];
          const b = enriched[j];
          const aSupers = new Set(a.supermarkets);
          const bSupers = new Set(b.supermarkets);
          const overlap = [...aSupers].filter((s) => bSupers.has(s));
          if (overlap.length === aSupers.size && overlap.length === bSupers.size) continue;
          pairs.push({ a, b, overlap });
        }
      }

      if (pairs.length === 0) {
        console.log(`\n  ⚠  nenhum par cross-mercado possível (todos mesmo mercado).`);
        continue;
      }

      console.log(`\n  Pair gate analysis (${pairs.length} pares cross-mercado candidatos):`);
      let passCount = 0;
      for (const { a, b } of pairs) {
        const g = analyzeGate(a, b, tc.expectedBrand);
        const status = g.fails.length === 0 ? 'PASS' : `FAIL ${g.fails.join(' · ')}`;
        if (g.fails.length === 0) passCount += 1;
        console.log(
          `    ${a.id.slice(0, 8)}(${a.supermarkets.join(',')}) × ${b.id.slice(0, 8)}(${b.supermarkets.join(',')}) → ${status}`,
        );
      }
      console.log(`  Pares que passariam TODOS gates: ${passCount}/${pairs.length}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
