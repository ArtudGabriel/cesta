// Sprint 135 — one-shot migration Vercel Blob → Cloudflare R2.
//
// Lê Product.imageUrl que aponta pra **.public.blob.vercel-storage.com,
// baixa bytes (reads Blob ainda funcionam no free tier), re-upload para
// R2 via PutObjectCommand, update Product.imageUrl → URL r2.dev.
// Idempotente: pula produtos cuja imageUrl já aponta pro R2.
//
// Rodar local:
//   export R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=...
//   export R2_BUCKET=cesta-products R2_PUBLIC_BASE_URL=https://pub-...r2.dev
//   export DATABASE_URL=postgres://...
//   npx ts-node scripts/migrate-blob-to-r2.ts [--limit=1000] [--dry-run]
//
// Em prod (Render): executar via Render shell OR POST /admin/catalog-sync/... (não
// recomendo — rode via shell pra ter output completo).

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';

const BLOB_HOST_SUFFIX = '.public.blob.vercel-storage.com';
const DOWNLOAD_TIMEOUT_MS = 15_000;
const INTER_UPLOAD_JITTER_MS = 150;

interface Args {
  limit: number;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { limit: 1000, dryRun: false };
  for (const token of argv.slice(2)) {
    if (token === '--dry-run') args.dryRun = true;
    else if (token.startsWith('--limit=')) {
      const v = parseInt(token.slice(8), 10);
      if (Number.isFinite(v) && v > 0) args.limit = v;
    }
  }
  return args;
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`env ausente: ${name}`);
  return v;
}

function inferExtension(url: string): string {
  const u = url.toLowerCase();
  if (u.includes('.webp')) return 'webp';
  if (u.includes('.png')) return 'png';
  if (u.includes('.jpeg')) return 'jpeg';
  return 'jpg';
}

function inferContentType(ext: string): string {
  if (ext === 'webp') return 'image/webp';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpeg') return 'image/jpeg';
  return 'image/jpeg';
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function downloadBytes(url: string): Promise<Buffer | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      console.warn(`  download fail status=${res.status} url=${url}`);
      return null;
    }
    const arr = await res.arrayBuffer();
    return Buffer.from(arr);
  } catch (err) {
    clearTimeout(timeout);
    console.warn(`  download throw url=${url} err=${(err as Error).message}`);
    return null;
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const bucket = env('R2_BUCKET');
  const publicBase = env('R2_PUBLIC_BASE_URL').replace(/\/+$/, '');
  const accountId = process.env.R2_ACCOUNT_ID;
  const endpoint =
    process.env.R2_S3_ENDPOINT ??
    (accountId
      ? `https://${accountId}.r2.cloudflarestorage.com`
      : (() => {
          throw new Error(
            'R2_ACCOUNT_ID ou R2_S3_ENDPOINT obrigatório',
          );
        })());

  console.log(
    `migrate-blob-to-r2: limit=${args.limit} dryRun=${args.dryRun} bucket=${bucket} endpoint=${endpoint} public=${publicBase}`,
  );

  const prisma = new PrismaClient();
  const s3 = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId: env('R2_ACCESS_KEY_ID'),
      secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
    },
  });

  // Estratégia: busca Products com imageUrl contendo o host do Blob.
  // Postgres LIKE funciona sem precisar regex.
  const candidates = await prisma.product.findMany({
    where: {
      deletedAt: null,
      imageUrl: { contains: BLOB_HOST_SUFFIX },
    },
    select: { id: true, imageUrl: true },
    take: args.limit,
    orderBy: { createdAt: 'asc' },
  });

  console.log(`encontrados ${candidates.length} produtos com Blob URL`);

  let migrated = 0;
  let skipped = 0;
  let errored = 0;

  for (const p of candidates) {
    if (!p.imageUrl) {
      skipped += 1;
      continue;
    }
    if (p.imageUrl.includes(publicBase)) {
      // Já no R2 (segurança contra re-processamento em paralelo).
      console.log(`  skip ${p.id} (already R2)`);
      skipped += 1;
      continue;
    }

    const ext = inferExtension(p.imageUrl);
    const contentType = inferContentType(ext);
    const key = `products/${p.id}.${ext}`;
    const targetUrl = `${publicBase}/${key}`;

    if (args.dryRun) {
      console.log(`  [dry] ${p.id}: ${p.imageUrl} → ${targetUrl}`);
      migrated += 1;
      continue;
    }

    const bytes = await downloadBytes(p.imageUrl);
    if (!bytes) {
      errored += 1;
      continue;
    }

    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: bytes,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
    } catch (err) {
      console.error(`  upload fail ${p.id}: ${(err as Error).message}`);
      errored += 1;
      continue;
    }

    await prisma.product.update({
      where: { id: p.id },
      data: { imageUrl: targetUrl },
    });

    migrated += 1;
    console.log(`  ok ${p.id} → ${targetUrl}`);
    await sleep(INTER_UPLOAD_JITTER_MS);
  }

  await prisma.$disconnect();

  console.log(
    `\nmigrate done: migrated=${migrated} skipped=${skipped} errored=${errored}`,
  );
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
