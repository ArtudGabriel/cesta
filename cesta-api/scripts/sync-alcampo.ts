/* eslint-disable no-console */
/**
 * Sprint 138 — Alcampo manual sync (opt B).
 *
 * One-shot script: instancia AlcampoAdapter + PrismaClient direto (sem DI).
 * Rodado manualmente pelo user a partir do laptop. Alcampo AWS WAF
 * `jsapi.js` challenge bloqueia datacenter — local Puppeteer passa.
 *
 * Flow:
 *  1. Upsert Supermarket slug=alcampo
 *  2. AlcampoAdapter.fetchProducts() (sitemap bareFetch + Puppeteer pages)
 *  3. Pra cada raw: upsert Product + ProductPrice + PriceSnapshot
 *
 * Uso:
 *   cd cesta-api
 *   npm run sync:alcampo -- --max-products=30
 *   npm run sync:alcampo -- --dry-run
 *
 * Flags:
 *   --max-products=N  → trunca pages Puppeteer (default 120; MVP curto usa 30)
 *   --limit=N         → trunca produtos pós-fetch
 *   --dry-run         → zero writes DB
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
  const maxProductsArg = args.find((a) => a.startsWith('--max-products='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;
  const maxProducts = maxProductsArg
    ? parseInt(maxProductsArg.split('=')[1], 10)
    : undefined;
  const dryRun = args.includes('--dry-run');
  return { limit, maxProducts, dryRun };
}

function toMeasureUnit(u: RawPackageUnit): MeasureUnit {
  return u as unknown as MeasureUnit;
}

async function main(): Promise<void> {
  const { limit, maxProducts, dryRun } = parseFlags();
  if (maxProducts != null) process.env.ALCAMPO_MAX_PRODUCTS = String(maxProducts);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { AlcampoAdapter } = require(
    '../src/modules/catalog-sync/adapters/alcampo.adapter',
  ) as typeof import('../src/modules/catalog-sync/adapters/alcampo.adapter');

  if (!process.env.DATABASE_URL) {
    console.error(
      '[sync-alcampo] DATABASE_URL ausente — configure cesta-api/.env antes de rodar',
    );
    process.exit(1);
  }

  console.log(
    `[sync-alcampo] flags: limit=${limit ?? 'none'} maxProducts=${maxProducts ?? 'default(120)'} dryRun=${dryRun}`,
  );

  const prisma = new PrismaClient();
  const adapter = new AlcampoAdapter();

  try {
    const supermarket = await prisma.supermarket.upsert({
      where: { slug: 'alcampo' },
      create: {
        slug: 'alcampo',
        name: 'Alcampo',
        color: '#E61E28',
        website: 'https://www.compraonline.alcampo.es',
        isActive: true,
      },
      update: {},
    });
    console.log(`[sync-alcampo] supermarket ok id=${supermarket.id}`);

    const before = await prisma.productPrice.count({
      where: { supermarketId: supermarket.id },
    });
    console.log(`[sync-alcampo] product_prices antes: ${before}`);

    console.log('[sync-alcampo] fetching Alcampo via sitemap + Puppeteer...');
    const rawProducts = await adapter.fetchProducts();
    console.log(
      `[sync-alcampo] fetch retornou ${rawProducts.length} raw products`,
    );

    if (rawProducts.length === 0) {
      console.log(
        '[sync-alcampo] ZERO produtos — ver logs acima (WAF challenge? Chrome missing?)',
      );
      return;
    }

    const sliced = limit ? rawProducts.slice(0, limit) : rawProducts;
    if (limit) console.log(`[sync-alcampo] aplicando --limit=${limit}`);

    console.log('[sync-alcampo] 5 amostras:');
    for (const r of sliced.slice(0, 5)) {
      console.log(
        `  - ${r.name} | ${r.brand ?? '?'} | ean=${r.ean ?? '-'} | €${r.price} | ${r.packageSize}${r.packageUnit}`,
      );
    }

    if (dryRun) {
      console.log('[sync-alcampo] --dry-run, sem escrita no DB');
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
        console.warn(`[sync-alcampo] fail ${raw.externalId}: ${message}`);
      }
    }

    const after = await prisma.productPrice.count({
      where: { supermarketId: supermarket.id },
    });

    console.log('');
    console.log('[sync-alcampo] done.');
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
  console.error('[sync-alcampo] erro fatal:', err);
  process.exit(1);
});
