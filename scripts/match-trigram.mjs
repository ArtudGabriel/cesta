#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Sprint 229 G3 (ADR 0039) — matching cross-mercado via pg_trgm.
 *
 * Faz a ponte para os adapters que NÃO expõem EAN (DIA, LIDL, Eroski,
 * Froiz — ver ADR 0038). Procura, para cada Product sem EAN e sem
 * canonicalProductId, canonicais plausíveis (ean populado,
 * canonicalProductId NULL) via pg_trgm `word_similarity` sobre
 * `normalized_name` + bônus por brand match.
 *
 * Threshold tiers:
 *   - score >= HIGH_THRESHOLD (default 0.75) → link direto (UPDATE
 *     duplicate.canonicalProductId = canonical.id · reusa S228 G2 FK).
 *   - LOW_THRESHOLD ≤ score < HIGH_THRESHOLD → INSERT em
 *     product_match_reviews (status='pending' pra decisão humana).
 *   - score < LOW_THRESHOLD (default 0.6) → ignorado.
 *
 * Config (env ou args):
 *   HIGH_THRESHOLD  default 0.75  (--high=0.8)
 *   LOW_THRESHOLD   default 0.6   (--low=0.55)
 *   BRAND_BONUS     default 0.1   (--bonus=0.15)
 *   LIMIT           default 500   (--limit=1000)
 *
 * Boss guards (herdados S228 G2):
 *  1. Migration ADITIVA · zero DROP/DELETE.
 *  2. Match LIGA · não apaga (só UPDATE canonicalProductId / INSERT review).
 *  3. Snapshot Neon antes --apply (reminder impresso).
 *  4. Dry-run default · --apply opt-in · idempotente (filtra
 *     canonicalProductId IS NULL · UNIQUE (dup,canon) no review table).
 *  5. Rollback documentado ADR 0039.
 *
 * Uso:
 *   node scripts/match-trigram.mjs                       # dry-run default
 *   node scripts/match-trigram.mjs --apply               # grava
 *   node scripts/match-trigram.mjs --apply --limit=1000
 *   node scripts/match-trigram.mjs --high=0.8 --low=0.55 --bonus=0.12
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { randomBytes } from 'node:crypto';

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
    low: getFlag('low', 0.6),
    bonus: getFlag('bonus', 0.1),
    limit: Math.round(getFlag('limit', 500)),
  };
}

/**
 * Para cada duplicate candidate, acha top-1 canonical via word_similarity
 * em normalized_name, com +bonus quando brand coincide (lowercase match).
 * Retorna [{duplicate_id, canonical_id, score, brand_match}].
 */
async function findCandidates(prisma, { low, high, bonus, limit }) {
  // $queryRaw com valores tagged pra Prisma escapar.
  // S231: retorna também brand+name originais pra classificação JS do
  // size_match (parse feito em processo).
  return prisma.$queryRaw`
    WITH duplicates AS (
      SELECT id, name, brand, normalized_name
      FROM products
      WHERE ean IS NULL
        AND canonical_product_id IS NULL
        AND deleted_at IS NULL
      LIMIT ${limit}
    ),
    canonicals AS (
      SELECT id, name, brand, normalized_name
      FROM products
      WHERE ean IS NOT NULL
        AND canonical_product_id IS NULL
        AND deleted_at IS NULL
    )
    SELECT
      d.id AS duplicate_id,
      d.name AS duplicate_name,
      d.brand AS duplicate_brand,
      c.id AS canonical_id,
      c.name AS canonical_name,
      c.brand AS canonical_brand,
      c.normalized_name AS canonical_normalized,
      word_similarity(d.normalized_name, c.normalized_name)
        + CASE
            WHEN d.brand IS NOT NULL
              AND c.brand IS NOT NULL
              AND LOWER(d.brand) = LOWER(c.brand)
            THEN ${bonus}::real
            ELSE 0::real
          END AS score,
      d.brand IS NOT NULL
        AND c.brand IS NOT NULL
        AND LOWER(d.brand) = LOWER(c.brand) AS brand_match
    FROM duplicates d
    CROSS JOIN LATERAL (
      SELECT c.id, c.name, c.brand, c.normalized_name
      FROM canonicals c
      WHERE word_similarity(d.normalized_name, c.normalized_name) >= ${low}::real
      ORDER BY word_similarity(d.normalized_name, c.normalized_name) DESC
      LIMIT 1
    ) c
    WHERE (
      word_similarity(d.normalized_name, c.normalized_name)
        + CASE
            WHEN d.brand IS NOT NULL
              AND c.brand IS NOT NULL
              AND LOWER(d.brand) = LOWER(c.brand)
            THEN ${bonus}::real
            ELSE 0::real
          END
    ) >= ${low}::real
    ORDER BY d.id
  `;
}

/**
 * Sprint 231 (Boss trava 2026-11-27 18:46Z vinculante): extrai size
 * canônico normalizado do nome. Retorna objeto `{value, unit}` ou null.
 *
 * - Litros: "2 l", "2l", "1.5l", "1,5 L" → { value: 2000, unit: 'ml' }.
 * - Mililitros: "500 ml", "330ml" → { value: 500, unit: 'ml' }.
 * - Quilos: "1kg", "0.5 kg", "500g", "500gr" → { value: 500, unit: 'g' }.
 * - Pack: "pack 6", "pack-6", "x6", "6 un", "6 unidades" → { value: 6, unit: 'pack' }.
 *
 * Tudo convertido pra ml (líquido) ou g (sólido) ou pack (contagem) pra
 * comparação direta `a.value == b.value && a.unit == b.unit`. 2L !== 1.5L ·
 * 330ml !== 500ml · pack 6 !== unit (null unit).
 */
function parseSize(text) {
  if (!text || typeof text !== 'string') return null;
  const s = text.toLowerCase();
  // Pack / contagem primeiro (menos ambíguo).
  const packMatch = s.match(/(?:pack\s*|x\s*)(\d+)\b/);
  if (packMatch) {
    const n = parseInt(packMatch[1], 10);
    if (Number.isFinite(n) && n > 1) return { value: n, unit: 'pack' };
  }
  // ml
  const mlMatch = s.match(/(\d+(?:[.,]\d+)?)\s*ml\b/);
  if (mlMatch) {
    const v = parseFloat(mlMatch[1].replace(',', '.'));
    if (Number.isFinite(v) && v > 0) return { value: Math.round(v), unit: 'ml' };
  }
  // l (não ml) - exige word boundary antes do l
  const lMatch = s.match(/(\d+(?:[.,]\d+)?)\s*l\b(?!\w)/);
  if (lMatch && !/ml\b/.test(s)) {
    const v = parseFloat(lMatch[1].replace(',', '.'));
    if (Number.isFinite(v) && v > 0) return { value: Math.round(v * 1000), unit: 'ml' };
  }
  // kg
  const kgMatch = s.match(/(\d+(?:[.,]\d+)?)\s*kg\b/);
  if (kgMatch) {
    const v = parseFloat(kgMatch[1].replace(',', '.'));
    if (Number.isFinite(v) && v > 0) return { value: Math.round(v * 1000), unit: 'g' };
  }
  // g / gr (não kg)
  const gMatch = s.match(/(\d+(?:[.,]\d+)?)\s*gr?\b/);
  if (gMatch && !/kg\b/.test(s)) {
    const v = parseFloat(gMatch[1].replace(',', '.'));
    if (Number.isFinite(v) && v > 0) return { value: Math.round(v), unit: 'g' };
  }
  return null;
}

function sizeMatch(a, b) {
  const sa = parseSize(a);
  const sb = parseSize(b);
  if (!sa || !sb) return false; // sem size detectado em alguma → NÃO link
  return sa.unit === sb.unit && sa.value === sb.value;
}

function cuid() {
  // Compatible com cuid prisma default: prefix 'c' + 24 chars hex-like.
  return 'c' + randomBytes(12).toString('hex');
}

async function main() {
  const { apply, high, low, bonus, limit } = parseArgs();
  process.env.DATABASE_URL = loadDatabaseUrl();
  const prisma = new PrismaClient();

  try {
    console.log('='.repeat(72));
    console.log('Sprint 229 G3 — match-trigram');
    console.log('='.repeat(72));
    console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
    console.log(`Thresholds: high=${high} low=${low} brand_bonus=${bonus}`);
    console.log(`Limit duplicates por run: ${limit}`);
    if (apply) {
      console.log('\n⚠️  Boss guard: snapshot Neon ANTES de continuar.');
      console.log('   https://console.neon.tech/app/projects → create branch');
      console.log('   Rollback: UPDATE products SET canonical_product_id = NULL WHERE id IN (updated);');
      console.log('   Rollback review: DELETE FROM product_match_reviews WHERE created_at > <timestamp>;');
    }

    const rawCandidates = await findCandidates(prisma, { low, high, bonus, limit });

    // Sprint 231 (Boss trava): enriquece com size_match + classifica de novo.
    // HIGH link requer TODOS: score >= HIGH · brand_match · size_match.
    // Qualquer gate falho descendo pra review (ou skip se score < LOW).
    const candidates = rawCandidates.map((c) => {
      const sizeM = sizeMatch(c.duplicate_name, c.canonical_name);
      const score = Number(c.score);
      const brandM = Boolean(c.brand_match);
      const dupSize = parseSize(c.duplicate_name);
      const canSize = parseSize(c.canonical_name);
      let tier;
      if (score >= high && brandM && sizeM) tier = 'high_auto';
      else if (score >= low) tier = 'review'; // inclui score>=high mas sem size/brand match
      else tier = 'skip';
      return { ...c, size_match: sizeM, dup_size: dupSize, can_size: canSize, score_num: score, tier };
    });

    const total = candidates.length;
    const high_matches = candidates.filter((c) => c.tier === 'high_auto');
    const review_matches = candidates.filter((c) => c.tier === 'review');
    const demoted_matches = candidates.filter(
      (c) => c.score_num >= high && c.tier === 'review',
    );
    console.log(`\nCandidatos (score>=${low}): ${total}`);
    console.log(`  high_auto (score>=${high} · brand=✓ · size=✓) → link direto: ${high_matches.length}`);
    console.log(`  review (resto): ${review_matches.length}`);
    console.log(`    dentre review: demoted (score>=${high} mas brand ou size falhou): ${demoted_matches.length}`);

    function fmt(sz) {
      return sz ? `${sz.value}${sz.unit}` : '∅';
    }

    // S231 Boss directive: sample 30 HIGH links PRÉ --apply pra QA review.
    const SAMPLE = parseInt(process.env.SAMPLE_HIGH ?? '30', 10);
    console.log(`\nSample HIGH (${Math.min(SAMPLE, high_matches.length)}/${high_matches.length}):`);
    console.log('-'.repeat(72));
    for (const c of high_matches.slice(0, SAMPLE)) {
      console.log(
        `  score=${c.score_num.toFixed(3)} brand=${c.brand_match ? '✓' : '×'} size=${c.size_match ? '✓' : '×'}  ` +
          `"${c.duplicate_name.slice(0, 44)}" [${c.duplicate_brand ?? '∅'}|${fmt(c.dup_size)}] → ` +
          `"${c.canonical_name.slice(0, 44)}" [${c.canonical_brand ?? '∅'}|${fmt(c.can_size)}]`,
      );
    }

    console.log(`\nSample REVIEW (top 10 demoted + top 10 low-score):`);
    console.log('-'.repeat(72));
    const reviewPreview = [
      ...demoted_matches.slice(0, 10),
      ...review_matches.filter((c) => c.score_num < high).slice(0, 10),
    ];
    for (const c of reviewPreview) {
      const reason =
        c.score_num >= high
          ? !c.brand_match
            ? 'brand×'
            : !c.size_match
              ? 'size×'
              : '?'
          : 'low-score';
      console.log(
        `  score=${c.score_num.toFixed(3)} reason=${reason}  ` +
          `"${c.duplicate_name.slice(0, 40)}" [${c.duplicate_brand ?? '∅'}|${fmt(c.dup_size)}] → ` +
          `"${c.canonical_name.slice(0, 40)}" [${c.canonical_brand ?? '∅'}|${fmt(c.can_size)}]`,
      );
    }

    if (!apply) {
      console.log('\n--dry-run: Nenhuma mudança gravada. Para aplicar: --apply');
      return;
    }

    // Apply high: UPDATE duplicate.canonicalProductId = canonical.id (G2 pattern).
    // Idempotência final: filtro canonicalProductId IS NULL impede re-apply.
    let linked = 0;
    for (const c of high_matches) {
      const r = await prisma.product.updateMany({
        where: {
          id: c.duplicate_id,
          canonicalProductId: null,
          ean: null,
        },
        data: { canonicalProductId: c.canonical_id },
      });
      linked += r.count;
    }
    console.log(`\n✅ Linked diretos: ${linked}/${high_matches.length}`);

    // Apply review: INSERT product_match_reviews (ignora UNIQUE conflict).
    let enqueued = 0;
    for (const c of review_matches) {
      try {
        await prisma.productMatchReview.create({
          data: {
            id: cuid(),
            duplicateProductId: c.duplicate_id,
            canonicalProductId: c.canonical_id,
            similarityScore: Number(c.score).toFixed(3),
            status: 'pending',
          },
        });
        enqueued += 1;
      } catch (e) {
        // UNIQUE (dup, canon) violation = já estava na fila. Idempotente.
        if (String(e).includes('Unique constraint')) continue;
        console.log(`  skip ${c.duplicate_id}: ${String(e).slice(0, 80)}`);
      }
    }
    console.log(`✅ Enfileirados pra review: ${enqueued}/${review_matches.length}`);
    console.log('\nPróximo: node scripts/audit-trigram-match.mjs');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
