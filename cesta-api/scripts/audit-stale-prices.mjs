#!/usr/bin/env node
// Sprint 241 (#6 badge DESACTUALIZADO) — audit read-only: % stale por
// supermarket + distribuição de lastSyncedAt + status do último SyncRun.
//
// Objetivo: identificar quais adapters estão causando o badge
// DESACTUALIZADO (ProductPrice.isStale OR lastSyncedAt > threshold)
// antes de decidir onde intervir.
//
// Sem writes, sem HTTP externo. Lê somente Product/ProductPrice/
// Supermarket/SyncRun.
//
// Uso:
//   node scripts/audit-stale-prices.mjs \
//     [--threshold-hours=48] [--limit=20] [--out=stale.json]
//
// Threshold default alinha com PRICE_STALE_THRESHOLD_HOURS do backend (48h).

import { writeFileSync } from 'node:fs';

function parseFlags() {
  const args = process.argv.slice(2);
  const thresholdHours = Number(
    args.find((a) => a.startsWith('--threshold-hours='))?.split('=')[1] ?? 48,
  );
  const limit = Number(
    args.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 20,
  );
  const out = args.find((a) => a.startsWith('--out='))?.split('=')[1] ?? null;
  return { thresholdHours, limit, out };
}

function pct(n, total) {
  if (!total) return 0;
  return Math.round((n / total) * 10_000) / 100; // 2 casas
}

function fmtHoursAgo(date, now) {
  if (!date) return 'never';
  const delta = now - date.getTime();
  const hours = Math.floor(delta / (60 * 60 * 1000));
  if (hours < 1) return `${Math.max(0, Math.floor(delta / 60_000))}min`;
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.floor((p / 100) * sorted.length),
  );
  return sorted[idx];
}

async function main() {
  const flags = parseFlags();
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const now = Date.now();
  const thresholdMs = flags.thresholdHours * 60 * 60 * 1000;

  try {
    const supermarkets = await prisma.supermarket.findMany({
      orderBy: { slug: 'asc' },
      select: { id: true, slug: true, name: true, isActive: true },
    });

    const perSupermarket = [];

    for (const sm of supermarkets) {
      const [
        total,
        dbFlagStale,
        availableCount,
        deletedCount,
        oldest,
        newest,
        latestSync,
        ageSample,
      ] = await Promise.all([
        prisma.productPrice.count({
          where: { supermarketId: sm.id, deletedAt: null },
        }),
        prisma.productPrice.count({
          where: {
            supermarketId: sm.id,
            deletedAt: null,
            isStale: true,
          },
        }),
        prisma.productPrice.count({
          where: {
            supermarketId: sm.id,
            deletedAt: null,
            isAvailable: true,
          },
        }),
        prisma.productPrice.count({
          where: { supermarketId: sm.id, deletedAt: { not: null } },
        }),
        prisma.productPrice.findFirst({
          where: { supermarketId: sm.id, deletedAt: null },
          orderBy: { lastSyncedAt: 'asc' },
          select: { lastSyncedAt: true },
        }),
        prisma.productPrice.findFirst({
          where: { supermarketId: sm.id, deletedAt: null },
          orderBy: { lastSyncedAt: 'desc' },
          select: { lastSyncedAt: true },
        }),
        prisma.syncRun
          .findFirst({
            where: { supermarketSlug: sm.slug },
            orderBy: { startedAt: 'desc' },
          })
          .catch(() => null),
        prisma.productPrice.findMany({
          where: { supermarketId: sm.id, deletedAt: null },
          select: { lastSyncedAt: true },
          orderBy: { lastSyncedAt: 'desc' },
          // Amostra pra percentis; cap defensivo pra não puxar 20k rows.
          take: 2000,
        }),
      ]);

      const ages = ageSample.map(
        (row) => now - new Date(row.lastSyncedAt).getTime(),
      );
      const effectiveStaleSample = ages.filter((a) => a > thresholdMs).length;

      perSupermarket.push({
        slug: sm.slug,
        name: sm.name,
        isActive: sm.isActive,
        total,
        deletedCount,
        availableCount,
        dbFlagStale,
        dbFlagStalePct: pct(dbFlagStale, total),
        sampleSize: ages.length,
        sampleEffectiveStale: effectiveStaleSample,
        sampleEffectiveStalePct: pct(effectiveStaleSample, ages.length),
        oldestLastSyncedAt: oldest?.lastSyncedAt ?? null,
        oldestAge: oldest ? fmtHoursAgo(oldest.lastSyncedAt, now) : 'n/a',
        newestLastSyncedAt: newest?.lastSyncedAt ?? null,
        newestAge: newest ? fmtHoursAgo(newest.lastSyncedAt, now) : 'n/a',
        p50AgeHours: percentile(ages, 50)
          ? Math.round(percentile(ages, 50) / 3_600_000)
          : null,
        p95AgeHours: percentile(ages, 95)
          ? Math.round(percentile(ages, 95) / 3_600_000)
          : null,
        latestSync: latestSync
          ? {
              status: latestSync.status,
              startedAt: latestSync.startedAt,
              finishedAt: latestSync.finishedAt,
              itemsProcessed: latestSync.itemsProcessed,
              itemsFailed: latestSync.itemsFailed,
              errorMessage: latestSync.errorMessage?.slice(0, 200) ?? null,
            }
          : null,
      });
    }

    // Report formatado
    const lines = [];
    lines.push(
      `# audit-stale-prices · threshold=${flags.thresholdHours}h · ${new Date(
        now,
      ).toISOString()}`,
    );
    lines.push('');
    for (const s of perSupermarket) {
      lines.push(`## ${s.slug} (${s.name}) · active=${s.isActive}`);
      lines.push(
        `  rows: total=${s.total} · available=${s.availableCount} · deleted=${s.deletedCount}`,
      );
      lines.push(
        `  stale (DB flag): ${s.dbFlagStale}/${s.total} = ${s.dbFlagStalePct}%`,
      );
      lines.push(
        `  stale (effective age>threshold on sample ${s.sampleSize}): ${s.sampleEffectiveStale}/${s.sampleSize} = ${s.sampleEffectiveStalePct}%`,
      );
      lines.push(
        `  lastSyncedAt: oldest=${s.oldestAge} · newest=${s.newestAge} · p50=${s.p50AgeHours}h · p95=${s.p95AgeHours}h`,
      );
      if (s.latestSync) {
        const started = new Date(s.latestSync.startedAt).toISOString();
        lines.push(
          `  latest SyncRun: status=${s.latestSync.status} · started=${started} · processed=${s.latestSync.itemsProcessed} · failed=${s.latestSync.itemsFailed}`,
        );
        if (s.latestSync.errorMessage) {
          lines.push(`    error: ${s.latestSync.errorMessage}`);
        }
      } else {
        lines.push(`  latest SyncRun: (nenhum registrado)`);
      }
      lines.push('');
    }

    console.log(lines.join('\n'));

    if (flags.out) {
      writeFileSync(
        flags.out,
        JSON.stringify(
          {
            generatedAt: new Date(now).toISOString(),
            thresholdHours: flags.thresholdHours,
            supermarkets: perSupermarket,
          },
          null,
          2,
        ),
      );
      console.log(`\nJSON escrito em ${flags.out}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
