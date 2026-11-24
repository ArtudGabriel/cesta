/* eslint-disable no-console */
/**
 * Sprint 138 — Carrefour manual sync (opt B).
 *
 * One-shot script: instancia CarrefourAdapter + PrismaClient direto (sem DI).
 * Rodado manualmente pelo user a partir do laptop (IP residencial + Chrome
 * local). Carrefour tem Akamai `_abck` + bloqueio de datacenter — prod cron
 * fica OFF, local via Puppeteer passa.
 *
 * Flow:
 *  1. Upsert Supermarket slug=carrefour
 *  2. CarrefourAdapter.fetchProducts() via puppeteerFetch
 *  3. Pra cada raw: upsert Product + ProductPrice + PriceSnapshot
 *
 * Uso:
 *   cd cesta-api
 *   npm run sync:carrefour -- --max-queries=10
 *   npm run sync:carrefour -- --dry-run
 *
 * Flags:
 *   --max-queries=N  → trunca queries (default 20; MVP curto usa 10)
 *   --limit=N        → trunca produtos pós-fetch
 *   --dry-run        → zero writes DB
 *
 * Prereq:
 *   npx puppeteer browsers install chrome
 *   cat cesta-api/.env | grep DATABASE_URL  # prod Neon
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { Prisma, PrismaClient, MeasureUnit } from '@prisma/client';
import type { RawPackageUnit } from '../src/modules/catalog-sync/adapters/supermarket-adapter.interface';
import { slugifyName } from '../src/modules/catalog-sync/utils/slugify';

function parseFlags() {
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const maxQueriesArg = args.find((a) => a.startsWith('--max-queries='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;
  const maxQueries = maxQueriesArg
    ? parseInt(maxQueriesArg.split('=')[1], 10)
    : undefined;
  const dryRun = args.includes('--dry-run');
  return { limit, maxQueries, dryRun };
}

function toMeasureUnit(u: RawPackageUnit): MeasureUnit {
  return u as unknown as MeasureUnit;
}

async function main(): Promise<void> {
  const { limit, maxQueries, dryRun } = parseFlags();
  if (maxQueries != null) process.env.CARREFOUR_MAX_QUERIES = String(maxQueries);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { CarrefourAdapter } = require(
    '../src/modules/catalog-sync/adapters/carrefour.adapter',
  ) as typeof import('../src/modules/catalog-sync/adapters/carrefour.adapter');

  if (!process.env.DATABASE_URL) {
    console.error(
      '[sync-carrefour] DATABASE_URL ausente — configure cesta-api/.env antes de rodar',
    );
    process.exit(1);
  }

  console.log(
    `[sync-carrefour] flags: limit=${limit ?? 'none'} maxQueries=${maxQueries ?? 'default(20)'} dryRun=${dryRun}`,
  );

  const prisma = new PrismaClient();
  const adapter = new CarrefourAdapter();

  try {
    const supermarket = await prisma.supermarket.upsert({
      where: { slug: 'carrefour' },
      create: {
        slug: 'carrefour',
        name: 'Carrefour',
        color: '#004E9F',
        website: 'https://www.carrefour.es',
        isActive: true,
      },
      update: {},
    });
    console.log(`[sync-carrefour] supermarket ok id=${supermarket.id}`);

    const before = await prisma.productPrice.count({
      where: { supermarketId: supermarket.id },
    });
    console.log(`[sync-carrefour] product_prices antes: ${before}`);

    console.log('[sync-carrefour] fetching Carrefour via Puppeteer...');
    const rawProducts = await adapter.fetchProducts();
    console.log(
      `[sync-carrefour] fetch retornou ${rawProducts.length} raw products`,
    );

    if (rawProducts.length === 0) {
      console.log(
        '[sync-carrefour] ZERO produtos — ver logs acima (Akamai challenge? Chrome missing?)',
      );
      return;
    }

    const sliced = limit ? rawProducts.slice(0, limit) : rawProducts;
    if (limit) console.log(`[sync-carrefour] aplicando --limit=${limit}`);

    console.log('[sync-carrefour] 5 amostras:');
    for (const r of sliced.slice(0, 5)) {
      console.log(
        `  - ${r.name} | ${r.brand ?? '?'} | ean=${r.ean ?? '-'} | €${r.price} | ${r.packageSize}${r.packageUnit}`,
      );
    }

    if (dryRun) {
      console.log('[sync-carrefour] --dry-run, sem escrita no DB');
      return;
    }

    let created = 0;
    let updated = 0;
    let failed = 0;

    for (const raw of sliced) {
      try {
        const normalized = slugifyName(`${raw.brand ?? ''} ${raw.name}`);

        const existing = raw.ean
          ? await prisma.product.findFirst({
              where: { ean: raw.ean, deletedAt: null },
            })
          : await prisma.product.findFirst({
              where: { normalizedName: normalized, deletedAt: null },
            });

        const product = existing
          ? existing
          : await prisma.product.create({
              data: {
                name: raw.name,
                normalizedName: normalized,
                brand: raw.brand ?? null,
                ean: raw.ean ?? null,
                imageUrl: null,
                packageSize: new Prisma.Decimal(raw.packageSize),
                packageUnit: toMeasureUnit(raw.packageUnit),
                comparisonUnit: toMeasureUnit(raw.comparisonUnit),
              },
            });

        const priceExisting = await prisma.productPrice.findUnique({
          where: {
            productId_supermarketId: {
              productId: product.id,
              supermarketId: supermarket.id,
            },
          },
        });

        await prisma.productPrice.upsert({
          where: {
            productId_supermarketId: {
              productId: product.id,
              supermarketId: supermarket.id,
            },
          },
          create: {
            productId: product.id,
            supermarketId: supermarket.id,
            currentPrice: new Prisma.Decimal(raw.price),
            previousPrice:
              raw.previousPrice != null
                ? new Prisma.Decimal(raw.previousPrice)
                : null,
            onPromotion: raw.onPromotion,
            isAvailable: raw.isAvailable,
            source: 'official_api',
            confidenceScore: new Prisma.Decimal(1.0),
            isStale: false,
            lastSyncedAt: new Date(),
          },
          update: {
            previousPrice: priceExisting
              ? priceExisting.currentPrice
              : raw.previousPrice != null
                ? new Prisma.Decimal(raw.previousPrice)
                : null,
            currentPrice: new Prisma.Decimal(raw.price),
            onPromotion: raw.onPromotion,
            isAvailable: raw.isAvailable,
            source: 'official_api',
            confidenceScore: new Prisma.Decimal(1.0),
            isStale: false,
            lastSyncedAt: new Date(),
          },
        });

        await prisma.priceSnapshot.create({
          data: {
            productId: product.id,
            supermarketId: supermarket.id,
            price: new Prisma.Decimal(raw.price),
            onPromotion: raw.onPromotion,
            source: 'official_api',
          },
        });

        if (priceExisting) updated += 1;
        else created += 1;
      } catch (err) {
        failed += 1;
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[sync-carrefour] fail ${raw.externalId}: ${message}`);
      }
    }

    const after = await prisma.productPrice.count({
      where: { supermarketId: supermarket.id },
    });

    console.log('');
    console.log('[sync-carrefour] done.');
    console.log(`  processed:      ${sliced.length}`);
    console.log(`  created prices: ${created}`);
    console.log(`  updated prices: ${updated}`);
    console.log(`  failed:         ${failed}`);
    console.log(
      `  product_prices depois: ${after} (antes=${before}, delta=${after - before})`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[sync-carrefour] erro fatal:', err);
  process.exit(1);
});
