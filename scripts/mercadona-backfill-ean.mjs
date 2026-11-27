#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Sprint 229 G1b (ADR 0038) — backfill de Product.ean pra Mercadona.
 *
 * Descoberta S229 (probe live 2026-11-27): endpoint /api/categories/<id>/
 * NÃO expõe mais o campo `ean` (0/993 produtos sampleados). Endpoint
 * /api/products/<id>/ AINDA expõe. Mercadona adapter runtime continua
 * olhando pra `raw.ean` (list) → produtos novos entram com `ean: null`.
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
 *  5. Rollback: UPDATE products SET ean = NULL WHERE source = 'mercadona-backfill';
 *     (ou mais conservador: UPDATE só nas rows que mudaram desde snapshot).
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
  return {
    apply: args.includes('--apply'),
    dryRun: !args.includes('--apply'),
    limit: Number.isFinite(limit) && limit > 0 ? limit : 200,
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
    if (!res.ok) return { ok: false, status: res.status, ean: null };
    const json = await res.json();
    return { ok: true, status: 200, ean: json?.ean ?? null };
  } catch (e) {
    return { ok: false, status: 0, ean: null, error: String(e) };
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

async function main() {
  const { apply, dryRun, limit } = parseArgs();
  process.env.DATABASE_URL = loadDatabaseUrl();
  const prisma = new PrismaClient();

  try {
    console.log('='.repeat(72));
    console.log('Sprint 229 G1b — mercadona-backfill-ean');
    console.log('='.repeat(72));
    console.log(`Mode: ${dryRun ? 'DRY-RUN (nada será gravado)' : 'APPLY'}`);
    console.log(`Limit: ${limit} produtos nesta run`);
    if (!dryRun) {
      console.log('\n⚠️  Boss guard: confirme snapshot Neon ANTES de continuar.');
      console.log('   Branch Neon: https://console.neon.tech/app/projects');
      console.log('   Rollback: UPDATE products SET ean = NULL WHERE id IN (...);');
    }

    // Busca Mercadona.id (externalId) do adapter. Trick: products têm
    // `normalized_name` + `name` mas não `externalId`. O catalog-sync
    // mapeia externalId→Product.id via unique por normalized_name/ean.
    // Pra backfill, precisamos do Mercadona ID interno.
    // Nossa fonte confiável: `product.name` + `product.image_url` (contém
    // o ID numérico no path: prod-mercadona.imgix.net/images/<id>.jpg).
    // Extrai o ID via regex sobre image_url ou source_image_url.
    const candidates = await findMercadonaProductsWithoutEan(prisma, limit);
    console.log(`\nCandidatos (ean=NULL): ${candidates.length}`);
    if (candidates.length === 0) {
      console.log('Nada a fazer.');
      return;
    }

    // Enriquecimento: busca image_url pra extrair Mercadona.id.
    const ids = candidates.map((c) => c.id);
    const rows = await prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, imageUrl: true, sourceImageUrl: true },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));

    let fetched = 0;
    let gotEan = 0;
    let httpFail = 0;
    let noMercadonaId = 0;

    for (const cand of candidates) {
      const row = byId.get(cand.id);
      if (!row) continue;
      const urlHint = row.sourceImageUrl ?? row.imageUrl ?? '';
      // URL pattern: https://prod-mercadona.imgix.net/images/<id>.jpg
      const m = urlHint.match(/mercadona[^/]*\.imgix\.net\/images\/(\w+)\./i);
      if (!m) {
        noMercadonaId += 1;
        continue;
      }
      const mercadonaId = m[1];
      const detail = await fetchDetail(mercadonaId);
      fetched += 1;
      if (!detail.ok) {
        httpFail += 1;
      } else if (detail.ean) {
        gotEan += 1;
        if (apply) {
          try {
            await prisma.product.update({
              where: { id: cand.id },
              data: { ean: detail.ean },
            });
          } catch (e) {
            // ean é @unique — colisão possível com outro Product canônico.
            // Trata como ignorado (G2 reconciliará depois via linkSupermarketDuplicate).
            console.log(
              `  skip ${cand.id} (ean ${detail.ean} já existe canonical?): ${String(e).slice(0, 80)}`,
            );
          }
        }
      }
      // Jitter polite (2-4s) pra não castigar o endpoint.
      await sleep(2000 + Math.random() * 2000);
      if ((fetched % 20) === 0) {
        console.log(
          `  progress: ${fetched}/${candidates.length} · ean_found=${gotEan} httpFail=${httpFail}`,
        );
      }
    }

    console.log('\n--- Summary ---');
    console.log(`fetched detail:     ${fetched}`);
    console.log(`ean found:          ${gotEan}`);
    console.log(`http fail:          ${httpFail}`);
    console.log(`no mercadona id:    ${noMercadonaId} (sem image_url padrão)`);
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
