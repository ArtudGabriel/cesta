#!/usr/bin/env node
// Sprint 213 (ADR 0025) — estimativa bytes outbound mensal por fonte.
//
// Fontes contabilizadas:
//   (1) R2 uploads (backfill-images from-source + cron scan)
//   (2) R2 downloads (não aplicável — frontend consome CDN Cloudflare direto)
//   (3) Neon Postgres (cross-region queries DATABASE_URL outbound)
//   (4) Redis BullMQ (payload jobs + stalled polling)
//   (5) ScrapingBee (requests Carrefour/Alcampo) — pós-S213 ZERADO
//   (6) Sentry (breadcrumbs + events)
//   (7) HTTP responses pro frontend (JSON API)
//
// Output: tabela markdown + total bytes/mês + comparação vs Render Hobby 5GB.
// Pré-S213: ~6GB/mês (observed). Pós-S213 alvo: <4GB/mês.
//
// Usage: node scripts/estimate-outbound.mjs [--pre-s213 | --post-s213]

const MODE = process.argv.includes('--pre-s213') ? 'pre-s213' : 'post-s213';

const BYTES = { KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 };

function human(bytes) {
  if (bytes >= BYTES.GB) return `${(bytes / BYTES.GB).toFixed(2)}GB`;
  if (bytes >= BYTES.MB) return `${(bytes / BYTES.MB).toFixed(1)}MB`;
  if (bytes >= BYTES.KB) return `${(bytes / BYTES.KB).toFixed(1)}KB`;
  return `${bytes}B`;
}

// ───── Parâmetros observados/estimados ─────
const CATALOG_PRODUCTS = 8500;        // S200 marco snapshot
const PRODUCTS_SYNCED_PER_DAY = 500;  // média 6 adapters ativos
const IMAGE_AVG_BYTES = 45 * BYTES.KB; // webp ~45KB (S135)
const BACKFILL_HIT_RATE = 0.35;       // ~35% produtos novos têm imagem adapter
const BACKFILL_SCAN_PER_CRON = 50;    // DEFAULT_SCAN_LIMIT S133
const BACKFILL_CRONS_PER_DAY = 12;    // 2h cron
const DB_QUERY_AVG_BYTES = 1.5 * BYTES.KB; // SELECT product row + joins
const DB_QUERIES_PER_DAY = 50_000;    // API ~500/h × 24h × 4 users (estimado)
const REDIS_PAYLOAD_AVG_BYTES = 256;  // JSON job data pequena
const REDIS_JOBS_PER_DAY = PRODUCTS_SYNCED_PER_DAY * 3; // sync + alerts + backfill enqueue
const REDIS_POLL_BYTES_PER_SECOND_PRE = 80;  // BRPOPLPUSH header idle 5s × 12/min
const REDIS_POLL_BYTES_PER_SECOND_POST = 15; // drainDelay 30s → 2/min
const SCRAPINGBEE_REQ_BYTES = 8 * BYTES.KB; // request + credentials overhead
const SCRAPINGBEE_REQS_PER_DAY_PRE = 60;   // carrefour+alcampo cron daily
const SCRAPINGBEE_REQS_PER_DAY_POST = 0;   // removidos S213 G3
const SENTRY_EVENT_BYTES = 4 * BYTES.KB;
const SENTRY_EVENTS_PER_DAY = 100;    // breadcrumbs + errors
const API_RESPONSE_AVG_BYTES = 6 * BYTES.KB; // JSON lista produtos típica
const API_REQS_PER_DAY = 2_000;       // tráfego baixo MVP

const DAYS_PER_MONTH = 30;

function row(label, perDay, note = '') {
  const perMonth = perDay * DAYS_PER_MONTH;
  return { label, perDay, perMonth, note };
}

function compute(mode) {
  const isPre = mode === 'pre-s213';

  const r2Uploads =
    (PRODUCTS_SYNCED_PER_DAY * BACKFILL_HIT_RATE +
      BACKFILL_SCAN_PER_CRON * BACKFILL_CRONS_PER_DAY) *
    IMAGE_AVG_BYTES;

  const r2UploadsDisabledPost = isPre ? r2Uploads : 0;

  const dbQueries = DB_QUERIES_PER_DAY * DB_QUERY_AVG_BYTES;

  const redisJobs = REDIS_JOBS_PER_DAY * REDIS_PAYLOAD_AVG_BYTES;
  const redisPolling =
    (isPre ? REDIS_POLL_BYTES_PER_SECOND_PRE : REDIS_POLL_BYTES_PER_SECOND_POST) *
    60 *
    60 *
    24;

  const scrapingbee =
    (isPre ? SCRAPINGBEE_REQS_PER_DAY_PRE : SCRAPINGBEE_REQS_PER_DAY_POST) *
    SCRAPINGBEE_REQ_BYTES;

  const sentry = SENTRY_EVENTS_PER_DAY * SENTRY_EVENT_BYTES;

  const apiResponses = API_REQS_PER_DAY * API_RESPONSE_AVG_BYTES;

  return [
    row('R2 uploads (backfill-images)', r2UploadsDisabledPost,
      isPre ? 'cron scan + from-source enqueue' : 'DESABILITADO ADR 0025 G2'),
    row('Neon Postgres queries', dbQueries, 'cross-region outbound'),
    row('Redis BullMQ (payloads)', redisJobs, 'job add + ACK'),
    row('Redis BullMQ (polling)', redisPolling,
      isPre ? 'drainDelay 5s + stalledInterval 30s' : 'drainDelay 30s + stalledInterval 120s (G4)'),
    row('ScrapingBee', scrapingbee,
      isPre ? 'carrefour+alcampo cron' : 'ZERADO G3'),
    row('Sentry events', sentry),
    row('HTTP API responses', apiResponses, 'usuário-facing'),
  ];
}

function render(mode, rows) {
  const total = rows.reduce((s, r) => s + r.perMonth, 0);
  const lines = [];
  lines.push(`# Outbound estimate — ${mode}`);
  lines.push('');
  lines.push('| Fonte | /dia | /mês | Nota |');
  lines.push('|---|---:|---:|---|');
  for (const r of rows) {
    lines.push(`| ${r.label} | ${human(r.perDay)} | ${human(r.perMonth)} | ${r.note} |`);
  }
  lines.push(`| **TOTAL** | | **${human(total)}** | Render Hobby limit 5GB |`);
  lines.push('');
  const pctRender = ((total / (5 * BYTES.GB)) * 100).toFixed(1);
  lines.push(`Uso vs Render Hobby 5GB: **${pctRender}%**`);
  return lines.join('\n');
}

const rows = compute(MODE);
console.log(render(MODE, rows));
