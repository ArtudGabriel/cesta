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
      c.id AS canonical_id,
      c.name AS canonical_name,
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

    const candidates = await findCandidates(prisma, { low, high, bonus, limit });
    const total = candidates.length;
    const high_matches = candidates.filter((c) => Number(c.score) >= high);
    const review_matches = candidates.filter(
      (c) => Number(c.score) >= low && Number(c.score) < high,
    );
    console.log(`\nCandidatos (dup com acima low=${low}): ${total}`);
    console.log(`  high (>=${high}) → link direto: ${high_matches.length}`);
    console.log(`  review ([${low},${high})) → fila manual: ${review_matches.length}`);

    // Preview 5 high-matches + 5 review-matches
    console.log('\nPreview high (link direto, top 5):');
    for (const c of high_matches.slice(0, 5)) {
      console.log(
        `  score=${Number(c.score).toFixed(3)} brand=${c.brand_match ? '✓' : '×'}  "${c.duplicate_name.slice(0, 32)}" → "${c.canonical_name.slice(0, 32)}"`,
      );
    }
    console.log('\nPreview review (fila manual, top 5):');
    for (const c of review_matches.slice(0, 5)) {
      console.log(
        `  score=${Number(c.score).toFixed(3)} brand=${c.brand_match ? '✓' : '×'}  "${c.duplicate_name.slice(0, 32)}" → "${c.canonical_name.slice(0, 32)}"`,
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
