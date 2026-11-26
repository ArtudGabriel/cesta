#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Sprint 216 (ADR 0026) — backfill-images standalone pra GitHub Actions cron.
 *
 * Reusa BackfillImagesService + BackfillImagesRepository + R2StorageService
 * via dist/ (requer `npm run build` antes).
 *
 * Why standalone .mjs (não cron Render): ADR 0025 suspendeu Render Hobby por
 * bandwidth outbound. R2 uploads consumiam ~1GB/mês dentro do runner Render.
 * Movendo pro runner GitHub Actions, R2 PUTs saem da banda GitHub (free tier
 * 2000min/mês runners Linux) — Render fica dentro do orçamento 2.5GB/mês.
 *
 * Cobertura lógica: unit specs em backfill-images.service.spec.ts (S133).
 * Standalone é glue code (bootstrap PrismaClient + instanciar classes CJS);
 * validação end-to-end via `workflow_dispatch` manual.
 *
 * Usage:
 *   DATABASE_URL=... R2_*=... node scripts/backfill-images-standalone.mjs --limit=100
 *
 * GHA workflow: .github/workflows/backfill-images.yml.
 */
import { createRequire } from 'node:module';
import process from 'node:process';
import { PrismaClient } from '@prisma/client';

const require_ = createRequire(import.meta.url);

function parseFlags() {
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const raw = limitArg ? limitArg.split('=')[1] : '100';
  const limit = parseInt(raw, 10);
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error(`invalid --limit value: ${raw}`);
  }
  return { limit };
}

function assertRequiredEnv() {
  const required = [
    'DATABASE_URL',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET',
    'R2_PUBLIC_BASE_URL',
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`missing env vars: ${missing.join(', ')}`);
  }
  if (!process.env.R2_ACCOUNT_ID && !process.env.R2_S3_ENDPOINT) {
    throw new Error('missing env var: R2_ACCOUNT_ID or R2_S3_ENDPOINT');
  }
}

async function main() {
  const { limit } = parseFlags();
  assertRequiredEnv();

  console.log(`[backfill-images-standalone] start limit=${limit}`);

  const {
    BackfillImagesService,
  } = require_('../dist/src/modules/catalog-sync/backfill-images.service.js');
  const {
    BackfillImagesRepository,
  } = require_('../dist/src/modules/catalog-sync/backfill-images.repository.js');
  const {
    R2StorageService,
  } = require_('../dist/src/modules/storage/r2-storage.service.js');

  const prisma = new PrismaClient();
  try {
    await prisma.$connect();

    // Repository construtor pede PrismaService (extends PrismaClient). Cliente
    // standalone passa PrismaClient direto — compatível em runtime.
    const repo = new BackfillImagesRepository(prisma);
    const storage = new R2StorageService();
    const service = new BackfillImagesService(repo, storage);

    const stats = await service.scanAndBackfill(limit);
    console.log(
      `[backfill-images-standalone] done scanned=${stats.scanned} uploaded=${stats.uploaded} fallback=${stats.fallback} errored=${stats.errored}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[backfill-images-standalone] fatal:', err);
  process.exit(1);
});
