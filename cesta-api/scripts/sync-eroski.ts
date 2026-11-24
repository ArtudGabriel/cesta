/* eslint-disable no-console */
/**
 * Sprint 137 — Eroski manual sync (opt B).
 *
 * One-shot script: instancia EroskiAdapter + PrismaClient direto (sem NestJS DI).
 * Rodado manualmente pelo user a partir do IP residencial — Eroski CDN bloqueia
 * Render us-east datacenter em páginas /es/supermercado/... (ADR pendente).
 *
 * Flow:
 *  1. Upsert Supermarket slug=eroski
 *  2. EroskiAdapter.fetchProducts() → RawProduct[] via sitemap + category HTML
 *  3. Pra cada raw:
 *     - Upsert Product (match por normalizedName — Eroski não expõe EAN)
 *     - Upsert ProductPrice source='official_api'
 *     - Create PriceSnapshot
 *  4. Log contagem antes/depois + N amostras
 *
 * Uso (dev local, DATABASE_URL apontando prod Neon via .env):
 *   cd cesta-api
 *   npm run sync:eroski -- --max-cats=20 --limit=200
 *   npm run sync:eroski -- --dry-run   # inspeciona fetch sem escrita
 *
 * Flags:
 *   --max-cats=N  → trunca categorias (default 60; MVP curto usa 20)
 *   --limit=N     → trunca produtos pós-fetch antes de upsert
 *   --dry-run     → zero writes DB
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
// Carrega .env ANTES de importar adapter — adapter lê EROSKI_MAX_CATEGORIES do env.
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { Prisma, PrismaClient, MeasureUnit } from '@prisma/client';
import type { RawPackageUnit } from '../src/modules/catalog-sync/adapters/supermarket-adapter.interface';
import { slugifyName } from '../src/modules/catalog-sync/utils/slugify';

function parseFlags() {
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const maxCatsArg = args.find((a) => a.startsWith('--max-cats='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;
  const maxCats = maxCatsArg ? parseInt(maxCatsArg.split('=')[1], 10) : undefined;
  const dryRun = args.includes('--dry-run');
  return { limit, maxCats, dryRun };
}

function toMeasureUnit(u: RawPackageUnit): MeasureUnit {
  return u as unknown as MeasureUnit;
}

async function main(): Promise<void> {
  const { limit, maxCats, dryRun } = parseFlags();
  // Set env ANTES de importar adapter (lazy require pra garantir que
  // resolveMaxCategories pegue o valor correto após dotenv).
  if (maxCats != null) process.env.EROSKI_MAX_CATEGORIES = String(maxCats);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { EroskiAdapter } = require(
    '../src/modules/catalog-sync/adapters/eroski.adapter',
  ) as typeof import('../src/modules/catalog-sync/adapters/eroski.adapter');

  if (!process.env.DATABASE_URL) {
    console.error(
      '[sync-eroski] DATABASE_URL ausente — configure cesta-api/.env antes de rodar',
    );
    process.exit(1);
  }

  console.log(
    `[sync-eroski] flags: limit=${limit ?? 'none'} maxCats=${maxCats ?? 'default(60)'} dryRun=${dryRun}`,
  );

  const prisma = new PrismaClient();
  const adapter = new EroskiAdapter();

  try {
    const supermarket = await prisma.supermarket.upsert({
      where: { slug: 'eroski' },
      create: {
        slug: 'eroski',
        name: 'Eroski',
        color: '#E30613',
        website: 'https://supermercado.eroski.es',
        isActive: true,
      },
      update: {},
    });
    console.log(`[sync-eroski] supermarket ok id=${supermarket.id}`);

    const before = await prisma.productPrice.count({
      where: { supermarketId: supermarket.id },
    });
    console.log(`[sync-eroski] product_prices antes: ${before}`);

    console.log('[sync-eroski] fetching Eroski sitemap + categorias...');
    const rawProducts = await adapter.fetchProducts();
    console.log(`[sync-eroski] fetch retornou ${rawProducts.length} raw products`);

    if (rawProducts.length === 0) {
      console.log('[sync-eroski] ZERO produtos — provável adapter bug OR CDN block.');
      console.log('[sync-eroski] Checar logs acima pra pistas (sitemap length, categorias folha, warnings).');
      return;
    }

    const sliced = limit ? rawProducts.slice(0, limit) : rawProducts;
    if (limit) console.log(`[sync-eroski] aplicando --limit=${limit}`);

    console.log('[sync-eroski] 5 amostras:');
    for (const r of sliced.slice(0, 5)) {
      console.log(
        `  - ${r.name} | ${r.brand ?? '?'} | externalId=${r.externalId} | €${r.price} | ${r.packageSize}${r.packageUnit}`,
      );
    }

    if (dryRun) {
      console.log('[sync-eroski] --dry-run, sem escrita no DB');
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
              raw.previousPrice != null ? new Prisma.Decimal(raw.previousPrice) : null,
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
        console.warn(`[sync-eroski] fail ${raw.externalId}: ${message}`);
      }
    }

    const after = await prisma.productPrice.count({
      where: { supermarketId: supermarket.id },
    });

    console.log('');
    console.log('[sync-eroski] done.');
    console.log(`  processed:      ${sliced.length}`);
    console.log(`  created prices: ${created}`);
    console.log(`  updated prices: ${updated}`);
    console.log(`  failed:         ${failed}`);
    console.log(`  product_prices depois: ${after} (antes=${before}, delta=${after - before})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[sync-eroski] erro fatal:', err);
  process.exit(1);
});
