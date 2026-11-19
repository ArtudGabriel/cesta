/* eslint-disable no-console */
/**
 * Sprint 108 — MVP Bloco 1: popular catálogo prod com produtos reais da Mercadona.
 *
 * One-shot bootstrap. Usa MercadonaAdapter (no DI deps) + PrismaClient direto.
 * NÃO enfileira jobs BullMQ nem invalida cache SSR — o CatalogSyncService
 * completo faz isso via /admin/catalog-sync/mercadona/run depois do MVP.
 *
 * Flow:
 *  1. Upsert Supermarket slug=mercadona
 *  2. MercadonaAdapter.fetchProducts() → RawProduct[] da API semi-pública
 *  3. Pra cada raw:
 *     - Upsert Product (match por ean, fallback normalizedName)
 *     - Upsert ProductPrice source='official_api'
 *     - Create PriceSnapshot
 *  4. Log contagem antes/depois + N amostras
 *
 * Uso:
 *   DATABASE_URL=postgres://... npx ts-node scripts/sync-mercadona.ts [--limit=N] [--dry-run]
 *
 * Em prod (Render shell):
 *   npx ts-node scripts/sync-mercadona.ts
 */
import { Prisma, PrismaClient, MeasureUnit } from '@prisma/client';
import { MercadonaAdapter } from '../src/modules/catalog-sync/adapters/mercadona.adapter';
import type { RawPackageUnit } from '../src/modules/catalog-sync/adapters/supermarket-adapter.interface';
import { slugifyName } from '../src/modules/catalog-sync/utils/slugify';

function parseFlags() {
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;
  const dryRun = args.includes('--dry-run');
  return { limit, dryRun };
}

function toMeasureUnit(u: RawPackageUnit): MeasureUnit {
  // RawPackageUnit tokens casam 1:1 com MeasureUnit enum do Prisma
  return u as unknown as MeasureUnit;
}

async function main(): Promise<void> {
  const { limit, dryRun } = parseFlags();
  const prisma = new PrismaClient();
  const adapter = new MercadonaAdapter();

  try {
    const supermarket = await prisma.supermarket.upsert({
      where: { slug: 'mercadona' },
      create: {
        slug: 'mercadona',
        name: 'Mercadona',
        color: '#009B3A',
        website: 'https://www.mercadona.es',
        isActive: true,
      },
      update: {},
    });
    console.log(`[sync-mercadona] supermarket ok id=${supermarket.id}`);

    const before = await prisma.productPrice.count({
      where: { supermarketId: supermarket.id },
    });
    console.log(`[sync-mercadona] product_prices antes: ${before}`);

    console.log('[sync-mercadona] fetching Mercadona API (jitter + retry)...');
    const rawProducts = await adapter.fetchProducts();
    console.log(`[sync-mercadona] fetch retornou ${rawProducts.length} raw products`);

    const sliced = limit ? rawProducts.slice(0, limit) : rawProducts;
    if (limit) console.log(`[sync-mercadona] aplicando --limit=${limit}`);

    if (dryRun) {
      console.log('[sync-mercadona] --dry-run, exibindo 5 amostras:');
      for (const r of sliced.slice(0, 5)) {
        console.log(`  - ${r.name} | ${r.brand ?? '?'} | ean=${r.ean ?? '-'} | €${r.price}`);
      }
      console.log('[sync-mercadona] dry-run concluído, sem escrita no DB');
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
                imageUrl: raw.imageUrl ?? null,
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
            previousPrice: raw.previousPrice != null ? new Prisma.Decimal(raw.previousPrice) : null,
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
        console.warn(`[sync-mercadona] fail ${raw.externalId}: ${message}`);
      }
    }

    const after = await prisma.productPrice.count({
      where: { supermarketId: supermarket.id },
    });

    console.log('');
    console.log(`[sync-mercadona] done.`);
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
  console.error('[sync-mercadona] erro fatal:', err);
  process.exit(1);
});
