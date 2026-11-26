#!/usr/bin/env node
/**
 * report-migrate-attempt.mjs
 *
 * Sprint 188 G2 — observability pro retry logic do render-build.sh (ADR 0013).
 *
 * Emite dois sinais por tentativa falha de `prisma migrate deploy`:
 *   1. Linha JSON estruturada em stdout (sempre, sem deps externos) — formato
 *      compatível com log drains JSON (Render → Sentry, Datadog, qualquer um).
 *   2. Sentry event opcional (apenas quando SENTRY_DSN está setado) — captura
 *      breadcrumb + info event com os mesmos campos.
 *
 * Campos emitidos (todos string-safe no stdout JSON):
 *   - event: "migrate_deploy_retry"
 *   - attempt_number: integer 1..3
 *   - error_code: string (P1002, P1012, ETIMEDOUT, ...; "unknown" default)
 *   - backoff_ms: integer (delay até próxima tentativa)
 *   - timestamp: ISO 8601
 *   - sprint: "S188" + adr reference
 *
 * Usage (bash):
 *   node scripts/report-migrate-attempt.mjs \
 *     --attempt 1 \
 *     --error-code P1002 \
 *     --backoff-ms 10000
 *
 * Exit code sempre 0 — nunca derruba o build pela observabilidade.
 */

import process from 'node:process';

function parseArgs(argv) {
  const out = { attempt: 0, errorCode: 'unknown', backoffMs: 0 };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const val = argv[i + 1];
    if (flag === '--attempt' && val) {
      out.attempt = Number.parseInt(val, 10);
      i += 1;
    } else if (flag === '--error-code' && val) {
      out.errorCode = val;
      i += 1;
    } else if (flag === '--backoff-ms' && val) {
      out.backoffMs = Number.parseInt(val, 10);
      i += 1;
    }
  }
  return out;
}

function buildPayload(args) {
  return {
    event: 'migrate_deploy_retry',
    attempt_number: Number.isFinite(args.attempt) ? args.attempt : 0,
    error_code: args.errorCode,
    backoff_ms: Number.isFinite(args.backoffMs) ? args.backoffMs : 0,
    timestamp: new Date().toISOString(),
    sprint: 'S188',
    adr: '0013',
  };
}

async function sendSentry(payload) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return { sent: false, reason: 'SENTRY_DSN not set' };
  let sentryModule;
  try {
    sentryModule = await import('@sentry/node');
  } catch (err) {
    return {
      sent: false,
      reason: `@sentry/node import failed: ${err.message ?? err}`,
    };
  }
  try {
    sentryModule.init({
      dsn,
      release: process.env.SENTRY_RELEASE,
      environment: process.env.NODE_ENV ?? 'production',
      sampleRate: 1.0,
      tracesSampleRate: 0,
    });
    sentryModule.addBreadcrumb({
      category: 'build.migrate',
      level: 'warning',
      message: `migrate deploy retry attempt ${payload.attempt_number}`,
      data: {
        attempt_number: payload.attempt_number,
        error_code: payload.error_code,
        backoff_ms: payload.backoff_ms,
      },
    });
    sentryModule.captureMessage(
      `migrate_deploy_retry attempt=${payload.attempt_number} code=${payload.error_code}`,
      {
        level: 'warning',
        tags: {
          adr: '0013',
          event: 'migrate_deploy_retry',
          error_code: payload.error_code,
        },
        extra: payload,
      },
    );
    await sentryModule.flush(5_000);
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: `sentry capture failed: ${err.message ?? err}` };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const payload = buildPayload(args);

  // Structured log (always). Downstream drain parsers key off the JSON shape.
  process.stdout.write(JSON.stringify(payload) + '\n');

  const sentryResult = await sendSentry(payload);
  if (!sentryResult.sent) {
    process.stderr.write(`sentry skip: ${sentryResult.reason}\n`);
  }
}

// Export pure helpers for unit tests.
export { parseArgs, buildPayload, sendSentry };

// Run only when invoked directly (not when imported in tests).
const isDirect = import.meta.url === `file://${process.argv[1]}`
  || import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/') ?? '');
if (isDirect) {
  main().catch((err) => {
    process.stderr.write(`report-migrate-attempt fatal: ${err?.message ?? err}\n`);
    process.exit(0);
  });
}
