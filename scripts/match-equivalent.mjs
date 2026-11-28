#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Sprint 245 (ADR 0046) — "produto equivalente" piloto 5 categorias.
 *
 * Diferente do match-cluster (S232) que agrupa "MESMO produto" (brand
 * igual · size igual · variant igual · nome similar), este script agrupa
 * "PRODUTO EQUIVALENTE": mesmo typeKey (leche entera, agua mineral, etc.)
 * + mesmo sizeCanon + marcas DIFERENTES. "Leche entera 1L" de Hacendado
 * (Mercadona), Dia Láctea (Dia), Milsani (Dia), Pascual (Carrefour) forma
 * 1 grupo equivalente → UI mostra selo amarelo "equivalente desde X€".
 *
 * Pipeline:
 *   1. SELECT produtos ativos (prices.some isAvailable deletedAt null)
 *      com canonical_product_id IS NULL (apenas canonicals).
 *   2. Para cada produto: classifyTypeKey → se null (fora piloto) skip.
 *   3. Calcula effectiveSize + variantCanon.
 *   4. Agrupa por equivalentGroupKey(typeKey, size, name).
 *   5. Descarta grupos size < 2 OU grupos sem 2+ brands distintas
 *      (Boss rule: equivalente exige marcas DIFERENTES).
 *   6. Gera cuid por grupo · UPDATE products SET equivalent_group_id
 *      WHERE id IN (membros) (idempotente: só mexe em quem está NULL
 *      OR grupo mudou).
 *
 * Boss guards (ADR 0046):
 *   - Migration ADITIVA (coluna equivalent_group_id nullable · S245 migration SQL).
 *   - LIGA não apaga (UPDATE apenas · zero DELETE).
 *   - PITR Neon antes --apply (timestamp UTC impresso).
 *   - Dry-run default · --apply opt-in.
 *   - Strict categoria + size · 2+ brands distintas.
 *   - Amostra 30 pré-apply (SAMPLE_GROUPS env default 30).
 *
 * Uso:
 *   node scripts/match-equivalent.mjs                     # dry-run full
 *   node scripts/match-equivalent.mjs --apply             # grava
 *   node scripts/match-equivalent.mjs --limit=500         # subset pra debug
 *   SAMPLE_GROUPS=50 node scripts/match-equivalent.mjs    # mais amostra
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import {
  extractBrand,
} from './lib/brand-normalize.mjs';
import {
  canonicalSize,
  classifyTypeKey,
  equivalentGroupKey,
  sizeCanon,
  variantCanon,
} from './lib/equivalent-types.mjs';

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
    limit: Math.round(getFlag('limit', 20000)),
  };
}

async function fetchCandidates(prisma, limit) {
  // Apenas canonicals ativos com pelo menos 1 price. Sprint 245b: inclui
  // supermarkets presentes (array) pro métrica groups-with-2+-supers no
  // relatório. Mercadona é identificada por supermarket.slug='mercadona'
  // (sanity check Boss métrica groups-with-Mercadona).
  return prisma.$queryRawUnsafe(
    `
    SELECT p.id, p.name, p.brand, p.package_size, p.package_unit,
           p.equivalent_group_id,
           array_agg(DISTINCT s.slug) FILTER (WHERE s.slug IS NOT NULL) AS super_slugs
    FROM products p
    JOIN product_prices pp ON pp.product_id = p.id
      AND pp.is_available = true AND pp.deleted_at IS NULL
    JOIN supermarkets s ON s.id = pp.supermarket_id AND s.is_active = true
    WHERE p.deleted_at IS NULL
      AND p.canonical_product_id IS NULL
    GROUP BY p.id, p.name, p.brand, p.package_size, p.package_unit,
             p.equivalent_group_id, p.created_at
    ORDER BY p.created_at ASC, p.id ASC
    LIMIT $1
    `,
    limit,
  );
}

// Sprint 245c (Boss bug 3): ovos têm package size ambíguo (packageSize=1
// UNIT no DB para a maioria; "12 un" fica só no nome). Para a família
// huevos, o size canonical é CONSTANTE `{value:1, unit:'un', pack:1}` e
// a quantidade (6/12/30), grade (S/M/L/XL) e cría (suelo/camperos/
// ecologicos) vão todas no `variantKey` — é lá que o agrupamento
// discrimina. Sem essa normalização, Mercadona e Dia nunca caem no
// mesmo bucket porque `packageSize` difere.
const HUEVO_CANONICAL_SIZE = { value: 1, unit: 'un', pack: 1 };

function bucketize(rows) {
  const buckets = new Map();
  let classified = 0;
  let droppedByType = 0;
  let droppedBySize = 0;
  for (const r of rows) {
    const brand = r.brand ?? extractBrand(r.name);
    const typeKey = classifyTypeKey(r.name, brand);
    if (!typeKey) {
      droppedByType += 1;
      continue;
    }
    // Sprint 245c (Boss rule 3): ovos ignoram sizeCanon do DB — toda a
    // discriminação vai pro variantKey (qty + grade + cría).
    let size;
    if (typeKey === 'huevos') {
      size = HUEVO_CANONICAL_SIZE;
    } else {
      // Sprint 245b (Boss rule 6): size AUTORITATIVA vem de
      // Product.packageSize+packageUnit; fallback ao parse do nome.
      // Null → produto FORA do piloto (não inferir).
      size = canonicalSize(r.name, r.package_size, r.package_unit);
      if (!size) {
        droppedBySize += 1;
        continue;
      }
    }
    classified += 1;
    const key = equivalentGroupKey(typeKey, size, r.name);
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        typeKey,
        sizeStr: sizeCanon(size),
        variantKey: variantCanon(r.name, typeKey),
        members: [],
      });
    }
    buckets.get(key).members.push({
      id: r.id,
      name: r.name,
      brand,
      superSlugs: r.super_slugs ?? [],
      existing_group: r.equivalent_group_id,
    });
  }
  return { buckets, classified, droppedByType, droppedBySize };
}

function filterGroups(buckets) {
  const groups = [];
  for (const b of buckets.values()) {
    if (b.members.length < 2) continue;
    const brands = new Set(
      b.members.map((m) => (m.brand ?? '').toLowerCase()).filter(Boolean),
    );
    // Boss rule: equivalente exige 2+ brands distintas.
    if (brands.size < 2) continue;
    // Sprint 245b: coleta supermarkets distintos do grupo (any member's price)
    // pra métrica Boss groups-with-2+-supers e groups-with-Mercadona.
    const supers = new Set();
    for (const m of b.members) {
      for (const s of m.superSlugs ?? []) supers.add(s);
    }
    groups.push({
      ...b,
      brands: [...brands],
      supers: [...supers],
    });
  }
  return groups;
}

async function main() {
  const { apply, limit } = parseArgs();
  process.env.DATABASE_URL = loadDatabaseUrl();
  const prisma = new PrismaClient();

  try {
    console.log('='.repeat(72));
    console.log('Sprint 245 (ADR 0046) — match-equivalent 5 categorias piloto');
    console.log('='.repeat(72));
    console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
    console.log(`Limit base produtos: ${limit}`);
    if (apply) {
      const nowUtc = new Date().toISOString();
      console.log('\n⚠️  Boss guard: snapshot Neon ANTES de continuar.');
      console.log(`   PITR timestamp (cole no PR): ${nowUtc}`);
      console.log(`   Rollback SQL: UPDATE products SET equivalent_group_id = NULL`);
      console.log(`     WHERE equivalent_group_id IS NOT NULL AND updated_at > '${nowUtc}';`);
    }

    console.log('\n[1/4] Fetch candidates...');
    const rows = await fetchCandidates(prisma, limit);
    console.log(`Candidates: ${rows.length}`);

    console.log('\n[2/4] Classify + bucketize...');
    const { buckets, classified, droppedByType, droppedBySize } = bucketize(rows);
    console.log(`Classified (dentro piloto + size válido): ${classified}`);
    console.log(`Dropped typeKey (fora piloto): ${droppedByType}`);
    console.log(`Dropped size (sem packageSize + sem size no nome): ${droppedBySize}`);
    console.log(`Buckets únicos: ${buckets.size}`);

    console.log('\n[3/4] Filter groups >=2 members + 2+ brands...');
    const groups = filterGroups(buckets).sort(
      (a, b) => b.members.length - a.members.length,
    );
    const totalMembers = groups.reduce((s, g) => s + g.members.length, 0);

    // Sprint 245b (Boss rule 7): métricas críticas pro PR body.
    const groupsMultiSuper = groups.filter((g) => g.supers.length >= 2).length;
    const groupsWithMercadona = groups.filter((g) =>
      g.supers.includes('mercadona'),
    ).length;

    console.log('\n=== MÉTRICAS S245b (Boss) ===');
    console.log(`Groups total:                ${groups.length}`);
    console.log(`Total members:               ${totalMembers}`);
    console.log(`Groups com 2+ supermarkets:  ${groupsMultiSuper}  ← crítica`);
    console.log(`Groups com Mercadona:        ${groupsWithMercadona}`);

    // Histogram por typeKey
    const byType = new Map();
    for (const g of groups) byType.set(g.typeKey, (byType.get(g.typeKey) ?? 0) + 1);
    if (byType.size > 0) {
      console.log('\nHistogram typeKey → #groups:');
      for (const [tk, n] of [...byType.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`  ${tk}: ${n}`);
      }
    }

    // Sprint 245c (Boss bug 4): diagnose leite Hacendado missing — dumpa
    // todos os candidatos Mercadona cujo classifier retornou leche-* mas
    // que não formaram grupo com DIA. Se vazio: Mercadona catalog real
    // não tem Hacendado leche ativo (canonical linked OR price inactive).
    console.log('\n=== DIAGNOSTIC S245c (bug 4) — Mercadona leche candidates ===');
    let mercLecheCount = 0;
    for (const r of rows) {
      const brand = r.brand ?? extractBrand(r.name);
      const typeKey = classifyTypeKey(r.name, brand);
      if (!typeKey || !typeKey.startsWith('leche-')) continue;
      const supers = r.super_slugs ?? [];
      if (!supers.includes('mercadona')) continue;
      mercLecheCount += 1;
      const size = canonicalSize(r.name, r.package_size, r.package_unit);
      console.log(
        `  "${r.name}" [${brand ?? '∅'}] pkg=${r.package_size}/${r.package_unit} canonSize=${size ? `${size.value}${size.unit}×${size.pack}` : 'NULL'} supers=${supers.join(',')} typeKey=${typeKey}`,
      );
    }
    if (mercLecheCount === 0) {
      console.log('  (zero candidates — Mercadona catalog não tem leche classificável ou prices inativos)');
    } else {
      console.log(`  Total Mercadona leche candidatos: ${mercLecheCount}`);
    }

    // Sprint 245b (Boss rule 9): dry-run imprime TODOS os membros full name
    // + supermercados (SEM slice). Boss lê o relatório inteiro antes de
    // autorizar --apply. Sample env preservado como opt-in truncate.
    const SAMPLE = parseInt(process.env.SAMPLE_GROUPS ?? String(groups.length), 10);
    const sampleCount = Math.min(SAMPLE, groups.length);
    console.log(`\n=== GROUPS (${sampleCount}/${groups.length}) ===`);
    console.log('-'.repeat(72));
    for (const g of groups.slice(0, sampleCount)) {
      console.log(
        `\n[${g.typeKey} · ${g.sizeStr}${g.variantKey ? ` · ${g.variantKey}` : ''}]`,
      );
      console.log(
        `  members=${g.members.length} brands=${g.brands.length} (${g.brands.join('|')}) supers=${g.supers.length} (${g.supers.join('|')})`,
      );
      for (const m of g.members) {
        const supers = (m.superSlugs ?? []).join(',');
        console.log(`    → "${m.name}" [${m.brand ?? '∅'}] @${supers || '∅'}`);
      }
    }

    if (!apply) {
      console.log('\n--dry-run: nenhuma mudança gravada. Para aplicar: --apply');
      return;
    }

    console.log('\n[4/4] APPLY — assignar equivalent_group_id...');
    let linked = 0;
    for (const g of groups) {
      // Reusa o group_id existente se qualquer member já tiver um atribuído
      // (idempotência: re-run não troca o id). Caso contrário gera novo cuid-like.
      const existing = g.members
        .map((m) => m.existing_group)
        .find((x) => x);
      const groupId = existing ?? `eq_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
      const toUpdate = g.members
        .filter((m) => m.existing_group !== groupId)
        .map((m) => m.id);
      if (toUpdate.length === 0) continue;
      const result = await prisma.$executeRawUnsafe(
        `UPDATE products SET equivalent_group_id = $1, updated_at = NOW()
         WHERE id = ANY($2::text[])`,
        groupId,
        toUpdate,
      );
      linked += result;
    }
    console.log(`\n✅ Apply concluído. ${linked} produtos linkados em ${groups.length} grupos equivalentes.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
