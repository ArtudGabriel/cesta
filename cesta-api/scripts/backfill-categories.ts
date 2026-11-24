/* eslint-disable no-console */
/**
 * Sprint 142 — one-shot backfill: resolve `category_id` para produtos
 * legacy sem categoria.
 *
 * Audit Neon 2026-11-24: 8553/8580 produtos (99.7%) com `category_id=NULL`.
 * CatalogSyncService nunca persistia resolved category — fix no mesmo PR
 * cobre produtos novos; este script cobre o backlog.
 *
 * Flow:
 *  1. Garante que as categorias seedadas existem (upsert).
 *  2. Carrega map slug → id.
 *  3. Pagina produtos `categoryId=NULL` + aplica `resolveCategorySlug`.
 *  4. Update em batch quando resolver; produto sem match fica NULL.
 *  5. Idempotente: filtro `categoryId=NULL` na query já pula os
 *     categorizados em runs anteriores.
 *
 * Uso:
 *   cd cesta-api
 *   npm run backfill:categories -- --dry-run
 *   npm run backfill:categories -- --limit=5000
 *
 * Flags:
 *   --limit=N   → trunca total de updates (default: sem limite, pagina 500 por iteração)
 *   --dry-run   → só imprime stats, zero writes
 *   --page-size → tamanho da página (default 500)
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { PrismaClient } from '@prisma/client';
import { resolveCategorySlug } from '../src/modules/catalog-sync/utils/category-resolver';

const DEFAULT_PAGE_SIZE = 500;

interface CategorySeed {
  slug: string;
  nameEs: string;
  namePt: string;
  order: number;
}

const CATEGORIES: CategorySeed[] = [
  { slug: 'lacteos', nameEs: 'Lácteos y huevos', namePt: 'Laticínios e ovos', order: 1 },
  { slug: 'pan-bolleria', nameEs: 'Pan y bollería', namePt: 'Pão e bolos', order: 2 },
  { slug: 'desayuno-cereales', nameEs: 'Desayuno y cereales', namePt: 'Café da manhã e cereais', order: 3 },
  { slug: 'carne', nameEs: 'Carnicería', namePt: 'Carnes', order: 4 },
  { slug: 'pescado', nameEs: 'Pescadería', namePt: 'Peixes', order: 5 },
  { slug: 'frutas-verduras', nameEs: 'Frutas y verduras', namePt: 'Frutas e verduras', order: 6 },
  { slug: 'bebidas', nameEs: 'Bebidas', namePt: 'Bebidas', order: 7 },
  { slug: 'despensa', nameEs: 'Despensa', namePt: 'Mercearia', order: 8 },
  { slug: 'salsas-conservas', nameEs: 'Salsas y conservas', namePt: 'Molhos e conservas', order: 9 },
  { slug: 'snacks-dulces', nameEs: 'Snacks y dulces', namePt: 'Snacks e doces', order: 10 },
  { slug: 'congelados', nameEs: 'Congelados', namePt: 'Congelados', order: 11 },
  { slug: 'limpieza', nameEs: 'Limpieza', namePt: 'Limpeza', order: 12 },
  { slug: 'higiene', nameEs: 'Higiene y belleza', namePt: 'Higiene e beleza', order: 13 },
  { slug: 'bebes', nameEs: 'Bebés', namePt: 'Bebês', order: 14 },
  { slug: 'mascotas', nameEs: 'Mascotas', namePt: 'Pets', order: 15 },
];

function parseFlags() {
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const pageArg = args.find((a) => a.startsWith('--page-size='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;
  const pageSize = pageArg
    ? parseInt(pageArg.split('=')[1], 10)
    : DEFAULT_PAGE_SIZE;
  const dryRun = args.includes('--dry-run');
  return { limit, pageSize, dryRun };
}

async function ensureCategories(prisma: PrismaClient): Promise<Map<string, string>> {
  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      create: {
        slug: c.slug,
        nameEs: c.nameEs,
        namePt: c.namePt,
        order: c.order,
      },
      update: {
        nameEs: c.nameEs,
        namePt: c.namePt,
        order: c.order,
      },
    });
  }
  const all = await prisma.category.findMany({
    select: { id: true, slug: true },
  });
  const map = new Map<string, string>();
  for (const row of all) map.set(row.slug, row.id);
  return map;
}

async function main(): Promise<void> {
  const { limit, pageSize, dryRun } = parseFlags();

  if (!process.env.DATABASE_URL) {
    console.error(
      '[backfill-categories] DATABASE_URL ausente — configure cesta-api/.env antes de rodar',
    );
    process.exit(1);
  }

  console.log(
    `[backfill-categories] flags: limit=${limit ?? 'none'} pageSize=${pageSize} dryRun=${dryRun}`,
  );

  const prisma = new PrismaClient();
  try {
    const slugToId = await ensureCategories(prisma);
    console.log(
      `[backfill-categories] categorias upserted: ${slugToId.size}`,
    );

    const totalWithout = await prisma.product.count({
      where: { categoryId: null, deletedAt: null },
    });
    const totalProducts = await prisma.product.count({
      where: { deletedAt: null },
    });
    console.log(
      `[backfill-categories] produtos sem categoria: ${totalWithout} / ${totalProducts} total`,
    );

    const perSlug = new Map<string, number>();
    let updated = 0;
    let unresolved = 0;
    let scanned = 0;
    const samplesUnresolved: string[] = [];

    while (true) {
      if (limit != null && updated >= limit) break;

      const page = await prisma.product.findMany({
        where: { categoryId: null, deletedAt: null },
        select: { id: true, name: true, brand: true },
        take: pageSize,
        orderBy: { createdAt: 'asc' },
      });
      if (page.length === 0) break;

      for (const p of page) {
        scanned += 1;
        if (limit != null && updated >= limit) break;

        // Legacy sem hint do adapter — passa `brand name` como productName
        // única fonte (resolver concatena hint+name no haystack; sem hint
        // aqui, evita duplicação).
        const fullName = `${p.brand ?? ''} ${p.name}`.trim();
        const slug = resolveCategorySlug(fullName);
        if (!slug) {
          unresolved += 1;
          if (samplesUnresolved.length < 10) samplesUnresolved.push(p.name);
          continue;
        }
        const categoryId = slugToId.get(slug);
        if (!categoryId) {
          unresolved += 1;
          continue;
        }

        perSlug.set(slug, (perSlug.get(slug) ?? 0) + 1);
        if (!dryRun) {
          await prisma.product.update({
            where: { id: p.id },
            data: { categoryId },
          });
        }
        updated += 1;
      }

      // Página inteira sem matches → break (evita loop infinito quando
      // o universo não-resolvido estagnar).
      if (updated === 0 && unresolved >= totalWithout) break;
      // Dry-run: a query re-executada acharia os mesmos produtos (nada
      // foi escrito). Sai depois de 1 página.
      if (dryRun) break;
    }

    console.log('');
    console.log('[backfill-categories] done.');
    console.log(`  scanned:    ${scanned}`);
    console.log(`  updated:    ${updated}`);
    console.log(`  unresolved: ${unresolved}`);
    const byCategoryDesc = [...perSlug.entries()].sort(
      (a, b) => b[1] - a[1],
    );
    console.log('  per categoria:');
    for (const [slug, n] of byCategoryDesc) {
      console.log(`    ${slug.padEnd(22)} ${n}`);
    }
    if (samplesUnresolved.length > 0) {
      console.log('  amostras unresolved:');
      for (const name of samplesUnresolved) {
        console.log(`    - ${name}`);
      }
    }

    if (!dryRun) {
      const afterWithout = await prisma.product.count({
        where: { categoryId: null, deletedAt: null },
      });
      const pct = totalProducts
        ? ((totalProducts - afterWithout) / totalProducts) * 100
        : 0;
      console.log(
        `  pós-run: ${afterWithout} / ${totalProducts} ainda sem categoria (${pct.toFixed(1)}% categorizados)`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[backfill-categories] erro fatal:', err);
  process.exit(1);
});
