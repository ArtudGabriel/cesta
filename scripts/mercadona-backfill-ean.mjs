#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Sprint 229 G1b + S230 fix (ADR 0038) — backfill de Product.ean pra
 * Mercadona.
 *
 * Descoberta S229 (probe live 2026-11-27): endpoint /api/categories/<id>/
 * NÃO expõe mais o campo `ean` (0/993 produtos sampleados). Endpoint
 * /api/products/<id>/ AINDA expõe. Mercadona adapter runtime continua
 * olhando pra `raw.ean` (list) → produtos novos entram com `ean: null`.
 *
 * **Sprint 230 fix (Boss finding 2026-11-27 18:40Z)**: dry-run --limit 30
 * quebrou (27/30 "no mercadona id · sem image_url padrão" · 3/30 HTTP fail
 * · 0 ean found). Root cause: `imageUrl` agora aponta pra R2 pós-S213+S216
 * (cesta-products...r2.dev/mercadona/<slug>.jpg) · regex Mercadona imgix
 * não bate. S224 ADR 0032 persistiu `sourceImageUrl` = URL ORIGINAL
 * pré-R2, mas só pra produtos syncados pós-S224. Fix:
 *   1. ID source: usar APENAS sourceImageUrl (não cair em imageUrl).
 *   2. Produtos sem sourceImageUrl → log `noSourceUrl` separado (aguarda
 *      próximo cron S224 populate).
 *   3. HTTP failure → log status + headers pra Boss diagnosticar
 *      rate-limit/UA ban.
 *
 * Esta é a ferramenta progressiva para enriquecer EAN em produtos da
 * Mercadona que já estão no DB sem EAN. Busca por N produtos por run,
 * fetch /api/products/<id>/ polite, atualiza DB.
 *
 * Opt-in · roda fora do cron:
 *   node scripts/mercadona-backfill-ean.mjs                 # dry-run (default)
 *   node scripts/mercadona-backfill-ean.mjs --apply         # grava
 *   node scripts/mercadona-backfill-ean.mjs --apply --limit 500
 *
 * Boss guards (herdados S228 G2):
 *  1. Aditivo (só UPDATE products.ean) · zero DROP/DELETE.
 *  2. LIGA, não apaga (products.ean=NULL fica null se detail não trouxer).
 *  3. Snapshot Neon antes de --apply em prod (script imprime reminder).
 *  4. Dry-run default · --apply opt-in · idempotente (filtra ean IS NULL).
 *  5. Rollback: coluna `source` NÃO existe em ProductPrice/Product; usar
 *     PITR Neon (restore point antes de --apply) OR UPDATE por timestamp:
 *       UPDATE products SET ean = NULL
 *         WHERE id IN (SELECT id FROM products
 *                      WHERE ean IS NOT NULL
 *                        AND updated_at > '<timestamp UTC do --apply>');
 *     Operador cola timestamp `date -u` ANTES de rodar --apply no PR body.
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

const MERCADONA_DETAIL_URL = (id) =>
  `https://tienda.mercadona.es/api/products/${encodeURIComponent(id)}/?lang=es&wh=mad1`;

// S230: regex padrão Mercadona imgix. Mantém suporte a hosts variantes
// (`prod-mercadona`, `cdn-prod-mercadona`, etc.) via `mercadona[^/]*`.
// Captura ID alphanumeric (adapter usa string, não int).
const MERCADONA_IMAGE_ID_RE =
  /mercadona[^/]*\.imgix\.net\/images\/(\w+)\./i;

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const raw = readFileSync(resolve(__dirname, '..', 'cesta-api', '.env'), 'utf8');
  const m = raw.match(/^DATABASE_URL=(.+)$/m);
  if (m) return m[1].replace(/^"|"$/g, '').trim();
  throw new Error('DATABASE_URL not found');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf('--limit');
  const limit =
    limitIdx >= 0 && args[limitIdx + 1]
      ? parseInt(args[limitIdx + 1], 10)
      : 200;
  const verbose = args.includes('--verbose');
  return {
    apply: args.includes('--apply'),
    dryRun: !args.includes('--apply'),
    limit: Number.isFinite(limit) && limit > 0 ? limit : 200,
    verbose,
  };
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchDetail(mercadonaId) {
  try {
    const res = await fetch(MERCADONA_DETAIL_URL(mercadonaId), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; Cesta-backfill/1.0; https://usecesta.es)',
        Accept: 'application/json',
        'Accept-Language': 'es-ES,es;q=0.9',
      },
    });
    // S230 fix: captura status + headers úteis pra diagnosticar
    // rate-limit/UA ban. Headers expostos: retry-after, cf-ray, x-request-id.
    const diag = {
      status: res.status,
      retryAfter: res.headers.get('retry-after'),
      cfRay: res.headers.get('cf-ray'),
      xRequestId: res.headers.get('x-request-id'),
    };
    if (!res.ok) return { ok: false, ean: null, ...diag };
    const json = await res.json();
    return { ok: true, ean: json?.ean ?? null, ...diag };
  } catch (e) {
    return { ok: false, ean: null, status: 0, error: String(e) };
  }
}

async function findMercadonaProductsWithoutEan(prisma, limit) {
  // Produtos ativos na Mercadona (têm ProductPrice no slug 'mercadona')
  // com ean=NULL. Order by id pra reprodutibilidade across runs (dedup
  // natural quando progride de lote em lote).
  return prisma.$queryRawUnsafe(
    `
    SELECT DISTINCT p.id, p.name
    FROM products p
    JOIN product_prices pp ON pp.product_id = p.id
    JOIN supermarkets s ON s.id = pp.supermarket_id
    WHERE s.slug = 'mercadona'
      AND p.ean IS NULL
      AND p.deleted_at IS NULL
    ORDER BY p.id
    LIMIT $1
    `,
    limit,
  );
}

function extractMercadonaId(sourceImageUrl) {
  if (!sourceImageUrl || typeof sourceImageUrl !== 'string') return null;
  const m = sourceImageUrl.match(MERCADONA_IMAGE_ID_RE);
  return m ? m[1] : null;
}

async function main() {
  const { apply, dryRun, limit, verbose } = parseArgs();
  process.env.DATABASE_URL = loadDatabaseUrl();
  const prisma = new PrismaClient();

  try {
    console.log('='.repeat(72));
    console.log('Sprint 229 G1b + S230 fix — mercadona-backfill-ean');
    console.log('='.repeat(72));
    console.log(`Mode: ${dryRun ? 'DRY-RUN (nada será gravado)' : 'APPLY'}`);
    console.log(`Limit: ${limit} produtos nesta run`);
    if (!dryRun) {
      const nowUtc = new Date().toISOString();
      console.log(`\n⚠️  Boss guard: snapshot Neon ANTES de continuar.`);
      console.log(`   https://console.neon.tech/app/projects → create branch`);
      console.log(`   PITR timestamp (cole no PR): ${nowUtc}`);
      console.log(`   Rollback SQL (secundário): UPDATE products SET ean = NULL`);
      console.log(`     WHERE ean IS NOT NULL AND updated_at > '${nowUtc}';`);
    }

    const candidates = await findMercadonaProductsWithoutEan(prisma, limit);
    console.log(`\nCandidatos (ean=NULL): ${candidates.length}`);
    if (candidates.length === 0) {
      console.log('Nada a fazer.');
      return;
    }

    const ids = candidates.map((c) => c.id);
    const rows = await prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, imageUrl: true, sourceImageUrl: true },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));

    let fetched = 0;
    let gotEan = 0;
    let httpFail = 0;
    // S230: separa 2 motivos distintos de skip pra Boss diagnosticar.
    let noSourceUrl = 0; // sourceImageUrl NULL ou vazio (produto legacy pré-S224).
    let noIdInUrl = 0; // sourceImageUrl presente mas regex não bateu.
    const httpFailDiag = []; // amostra de HTTP failures.

    for (const cand of candidates) {
      const row = byId.get(cand.id);
      if (!row) continue;

      // S230 fix: usa APENAS sourceImageUrl (não cai em imageUrl R2).
      // Produto legacy sem sourceImageUrl → skip + log (aguarda próximo
      // cron S224 populate · adapter já persiste sourceImageUrl desde S224).
      if (!row.sourceImageUrl) {
        noSourceUrl += 1;
        if (verbose) {
          console.log(`  skip ${cand.id} (noSourceUrl): "${cand.name.slice(0, 40)}"`);
        }
        continue;
      }

      const mercadonaId = extractMercadonaId(row.sourceImageUrl);
      if (!mercadonaId) {
        noIdInUrl += 1;
        if (verbose) {
          console.log(
            `  skip ${cand.id} (noIdInUrl): url="${row.sourceImageUrl.slice(0, 80)}"`,
          );
        }
        continue;
      }

      const detail = await fetchDetail(mercadonaId);
      fetched += 1;
      if (!detail.ok) {
        httpFail += 1;
        if (httpFailDiag.length < 10) {
          httpFailDiag.push({
            product_id: cand.id,
            mercadona_id: mercadonaId,
            status: detail.status,
            retryAfter: detail.retryAfter ?? null,
            cfRay: detail.cfRay ?? null,
            xRequestId: detail.xRequestId ?? null,
            error: detail.error ?? null,
          });
        }
      } else if (detail.ean) {
        gotEan += 1;
        if (apply) {
          try {
            await prisma.product.update({
              where: { id: cand.id },
              data: { ean: detail.ean },
            });
          } catch (e) {
            // ean é @unique — colisão possível com outro Product canônico
            // (G2 runtime vai reconciliar via linkSupermarketDuplicate).
            console.log(
              `  skip ${cand.id} (ean ${detail.ean} já canonical?): ${String(e).slice(0, 80)}`,
            );
          }
        }
      }
      // Jitter polite (2-4s) pra não castigar o endpoint.
      await sleep(2000 + Math.random() * 2000);
      if ((fetched % 20) === 0 && fetched > 0) {
        console.log(
          `  progress: fetched=${fetched} ean_found=${gotEan} httpFail=${httpFail} noSourceUrl=${noSourceUrl} noIdInUrl=${noIdInUrl}`,
        );
      }
    }

    console.log('\n--- Summary ---');
    console.log(`candidates:         ${candidates.length}`);
    console.log(`fetched detail:     ${fetched}`);
    console.log(`ean found:          ${gotEan}`);
    console.log(`http fail:          ${httpFail}`);
    console.log(`no source url:      ${noSourceUrl} (legacy pré-S224 · aguarda próximo cron S224 populate)`);
    console.log(`no id in url:       ${noIdInUrl} (sourceImageUrl presente mas regex Mercadona imgix não bateu · investigar URL shape)`);

    if (httpFailDiag.length > 0) {
      console.log('\n--- HTTP failures (sample) ---');
      for (const d of httpFailDiag) {
        console.log(
          `  product ${d.product_id} merc_id=${d.mercadona_id} status=${d.status}` +
            (d.retryAfter ? ` retry-after=${d.retryAfter}` : '') +
            (d.cfRay ? ` cf-ray=${d.cfRay}` : '') +
            (d.xRequestId ? ` x-request-id=${d.xRequestId}` : '') +
            (d.error ? ` err="${d.error.slice(0, 80)}"` : ''),
        );
      }
    }

    if (dryRun) {
      console.log('\n--dry-run: Nenhuma mudança gravada. Para aplicar: --apply');
    } else {
      console.log(`\n✅ Apply concluído. ${gotEan} EAN gravados.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
