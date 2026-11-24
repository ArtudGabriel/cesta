/* eslint-disable no-console */
/**
 * Sprint 141 — Froiz manual sync (opt B).
 *
 * One-shot script: instancia FroizAdapter + PrismaClient direto (sem DI).
 * Rodado manualmente pelo user a partir do laptop (IP residencial).
 * Froiz expõe sitemap + categoria HTML público com `.product` cards
 * SSR Nuxt — zero anti-bot aparente, scraping Cheerio simples.
 *
 * Flow:
 *  1. Upsert Supermarket slug=froiz
 *  2. FroizAdapter.fetchProducts() (sitemap bareFetch + categorias
 *     politeFetchRaw)
 *  3. Pra cada raw: upsert Product (normalizedName) + ProductPrice
 *     + PriceSnapshot
 *
 * Uso:
 *   cd cesta-api
 *   npm run sync:froiz -- --max-cats=20
 *   npm run sync:froiz -- --dry-run --max-cats=3
 *
 * Flags:
 *   --max-cats=N  → trunca categorias leaf fetched (default 60)
 *   --limit=N     → trunca produtos pós-fetch
 *   --dry-run     → zero writes DB
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
  const maxCatsArg = args.find((a) => a.startsWith('--max-cats='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;
  const maxCats = maxCatsArg
    ? parseInt(maxCatsArg.split('=')[1], 10)
    : undefined;
  const dryRun = args.includes('--dry-run');
  return { limit, maxCats, dryRun };
}

function toMeasureUnit(u: RawPackageUnit): MeasureUnit {
  return u as unknown as MeasureUnit;
}

async function main(): Promise<void> {
  const { limit, maxCats, dryRun } = parseFlags();
  if (maxCats != null) process.env.FROIZ_MAX_CATEGORIES = String(maxCats);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { FroizAdapter } = require(
    '../src/modules/catalog-sync/adapters/froiz.adapter',
  ) as typeof import('../src/modules/catalog-sync/adapters/froiz.adapter');

  if (!process.env.DATABASE_URL) {
    console.error(
      '[sync-froiz] DATABASE_URL ausente — configure cesta-api/.env antes de rodar',
    );
    process.exit(1);
  }

  console.log(
    `[sync-froiz] flags: limit=${limit ?? 'none'} maxCats=${maxCats ?? 'default(60)'} dryRun=${dryRun}`,
  );

  const prisma = new PrismaClient();
  const adapter = new FroizAdapter();

  try {
    const supermarket = await prisma.supermarket.upsert({
      where: { slug: 'froiz' },
      create: {
        slug: 'froiz',
        name: 'Froiz',
        color: '#4BA82E',
        website: 'https://supermercado.froiz.com',
        isActive: true,
      },
      update: {},
    });
    console.log(`[sync-froiz] supermarket ok id=${supermarket.id}`);

    const before = await prisma.productPrice.count({
      where: { supermarketId: supermarket.id },
    });
    console.log(`[sync-froiz] product_prices antes: ${before}`);

    console.log('[sync-froiz] fetching sitemap + categorias...');
    const rawProducts = await adapter.fetchProducts();
    console.log(
      `[sync-froiz] fetch retornou ${rawProducts.length} raw products`,
    );

    if (rawProducts.length === 0) {
      console.log('[sync-froiz] ZERO produtos — ver logs do adapter.');
      return;
    }

    const sliced = limit ? rawProducts.slice(0, limit) : rawProducts;
    if (limit) console.log(`[sync-froiz] aplicando --limit=${limit}`);

    console.log('[sync-froiz] 5 amostras:');
    for (const r of sliced.slice(0, 5)) {
      console.log(
        `  - ${r.name} | €${r.price} | ${r.packageSize}${r.packageUnit} | promo=${r.onPromotion}`,
      );
    }

    if (dryRun) {
      console.log('[sync-froiz] --dry-run, sem escrita no DB');
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
        console.warn(`[sync-froiz] fail ${raw.externalId}: ${message}`);
      }
    }

    const after = await prisma.productPrice.count({
      where: { supermarketId: supermarket.id },
    });

    console.log('');
    console.log('[sync-froiz] done.');
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
  console.error('[sync-froiz] erro fatal:', err);
  process.exit(1);
});
