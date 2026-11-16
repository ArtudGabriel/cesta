// Sprint 77 — Backfill de imagens de produtos para Vercel Blob.
//
// Estratégia:
//  1. Query produtos com imageUrl=null (idempotente — reruns ignoram preenchidos).
//  2. Tenta OpenFoodFacts por EAN (fonte pública, licenciada, já em remotePatterns).
//  3. Baixa bytes com politeFetch (jitter + backoff + UA rotation) + timeout curto.
//  4. Upload pra Vercel Blob em `products/{productId}.webp` (access=public, immutable).
//  5. Atualiza Product.imageUrl com URL retornada.
//  6. Produtos sem EAN ou sem match em OFF → fallback: imageUrl permanece null
//     (frontend serve /placeholder.webp estático, sem poluir Blob).
//
// Rodar:
//  export BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...   # vercel env pull cesta-api/.env
//  npx ts-node scripts/backfill-product-images.ts [--limit=50] [--dry-run]

import { put } from '@vercel/blob';
import { PrismaClient } from '@prisma/client';
import { pickUserAgent } from '../src/modules/catalog-sync/utils/user-agents';

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product';
const DOWNLOAD_TIMEOUT_MS = 10_000;
const MIN_JITTER_MS = 300;
const MAX_JITTER_MS = 1200;

interface OffResponse {
  status: 0 | 1;
  product?: {
    image_front_url?: string | null;
    image_url?: string | null;
  } | null;
}

function parseFlags() {
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;
  const dryRun = args.includes('--dry-run');
  return { limit, dryRun };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function fetchOff(ean: string): Promise<string | null> {
  await sleep(randomInt(MIN_JITTER_MS, MAX_JITTER_MS));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(`${OFF_BASE}/${encodeURIComponent(ean)}.json`, {
      headers: {
        'User-Agent': 'Cesta-App/0.1 (+contact: gabriel.augusto@vonex.com.br)',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = (await res.json()) as OffResponse;
    if (data.status !== 1 || !data.product) return null;
    return data.product.image_front_url ?? data.product.image_url ?? null;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

async function downloadImage(url: string): Promise<Buffer | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': pickUserAgent() },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    return Buffer.from(arr);
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

function inferContentType(url: string): string {
  const u = url.toLowerCase();
  if (u.endsWith('.webp')) return 'image/webp';
  if (u.endsWith('.png')) return 'image/png';
  if (u.endsWith('.jpg') || u.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/jpeg';
}

function inferExtension(url: string): string {
  const u = url.toLowerCase();
  if (u.endsWith('.webp')) return 'webp';
  if (u.endsWith('.png')) return 'png';
  if (u.endsWith('.jpeg')) return 'jpeg';
  return 'jpg';
}

async function main() {
  const { limit, dryRun } = parseFlags();
  if (!process.env.BLOB_READ_WRITE_TOKEN && !dryRun) {
    console.error('✗ BLOB_READ_WRITE_TOKEN ausente. Rode `vercel env pull` ou exporte manualmente.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const products = await prisma.product.findMany({
      where: { imageUrl: null, deletedAt: null },
      select: { id: true, name: true, ean: true, categoryId: true },
      take: limit,
    });
    console.log(`→ ${products.length} produtos sem imagem${limit ? ` (limit=${limit})` : ''}`);
    if (dryRun) console.log('  (dry-run: nada será enviado ao Blob nem salvo)');

    let scraped = 0;
    let fallback = 0;
    let errored = 0;

    for (const p of products) {
      if (!p.ean) {
        fallback += 1;
        console.log(`  · fallback (sem EAN): ${p.id} ${p.name}`);
        continue;
      }

      const sourceUrl = await fetchOff(p.ean);
      if (!sourceUrl) {
        fallback += 1;
        console.log(`  · fallback (OFF miss): ${p.id} ${p.name} ean=${p.ean}`);
        continue;
      }

      const bytes = await downloadImage(sourceUrl);
      if (!bytes) {
        errored += 1;
        console.log(`  ✗ erro download: ${p.id} ${sourceUrl}`);
        continue;
      }

      const ext = inferExtension(sourceUrl);
      const contentType = inferContentType(sourceUrl);
      const blobKey = `products/${p.id}.${ext}`;

      if (dryRun) {
        scraped += 1;
        console.log(`  ✓ (dry) ${blobKey} ← ${sourceUrl} (${bytes.length}b)`);
        continue;
      }

      try {
        const result = await put(blobKey, bytes, {
          access: 'public',
          contentType,
          addRandomSuffix: false,
          allowOverwrite: true,
          cacheControlMaxAge: 31_536_000,
        });
        await prisma.product.update({
          where: { id: p.id },
          data: { imageUrl: result.url },
        });
        scraped += 1;
        console.log(`  ✓ ${blobKey} → ${result.url}`);
      } catch (err) {
        errored += 1;
        console.log(`  ✗ erro upload: ${p.id} ${(err as Error).message}`);
      }
    }

    console.log('');
    console.log(`✓ scraped:   ${scraped}`);
    console.log(`· fallback:  ${fallback}  (placeholder frontend)`);
    console.log(`✗ errored:   ${errored}`);
    console.log(`= total:     ${products.length}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
