// Popula PriceSnapshot fake com últimos 30 dias por cada ProductPrice.
// Oscilação determinística ±5%. Idempotência: trunca snapshots source=seed_history antes.
// Rodar: npx ts-node scripts/seed-snapshots.ts
import { PrismaClient, Prisma } from '@prisma/client';

const DAYS = 30;

async function main() {
  const prisma = new PrismaClient();
  try {
    const deleted = await prisma.priceSnapshot.deleteMany({
      where: { source: 'seed_history' },
    });
    console.log(`✓ removidos ${deleted.count} snapshots prévios (seed_history)`);

    const prices = await prisma.productPrice.findMany({
      select: { productId: true, supermarketId: true, currentPrice: true },
    });
    console.log(`→ ${prices.length} product_prices`);

    const now = Date.now();
    let created = 0;
    for (const p of prices) {
      const base = Number(p.currentPrice);
      const rows = [];
      for (let d = DAYS; d >= 1; d -= 1) {
        const capturedAt = new Date(now - d * 24 * 60 * 60 * 1000);
        const seed = (d * 7 + p.productId.charCodeAt(0)) % 100;
        const delta = (seed - 50) / 1000; // ~±5%
        const price = Math.max(0.01, Math.round((base + base * delta) * 100) / 100);
        rows.push({
          productId: p.productId,
          supermarketId: p.supermarketId,
          price: new Prisma.Decimal(price),
          onPromotion: d % 11 === 0,
          source: 'seed_history',
          capturedAt,
        });
      }
      const result = await prisma.priceSnapshot.createMany({ data: rows });
      created += result.count;
    }
    console.log(`✓ ${created} snapshots gerados`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
