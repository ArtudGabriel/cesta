/**
 * BullMQ processor observability helpers — Sprint 191 G2.
 *
 * Centraliza emissão de Sentry breadcrumbs + captureException em processors.
 * Antes cada processor emitia logs próprios (Logger.log / Logger.error) sem
 * attach a eventos Sentry — attempt_number, retry scheduled, final fail não
 * apareciam na timeline do erro capturado.
 *
 * Eventos emitidos:
 *   - `recordJobStart`           → breadcrumb info (job iniciou)
 *   - `recordJobError`           → breadcrumb warning + captureException (final)
 *                                  ou breadcrumb warning only (retry scheduled)
 *
 * Payload de todos os breadcrumbs: {jobId, name, queue, attemptsMade, data}
 * `data` é snapshot shallow do job.data (BullMQ já serializa como JSON).
 *
 * Quando `SENTRY_DSN` ausente, `@sentry/node` v11 trata init como no-op; todos
 * os calls viram no-op sem throw. Esse módulo nunca derruba processor.
 */

import { Sentry } from './sentry.init';
import type { Job } from 'bullmq';

export type JobEventContext = {
  queueName: string;
  job: Pick<
    Job<unknown>,
    'id' | 'name' | 'data' | 'attemptsMade' | 'opts'
  >;
};

/** Determina se o attempt corrente é o último (BullMQ não vai re-enqueuar). */
export function isFinalAttempt(ctx: JobEventContext): boolean {
  const maxAttempts = ctx.job.opts?.attempts ?? 1;
  // BullMQ incrementa attemptsMade ANTES do process call. No throw, o retry
  // só agenda se attemptsMade < maxAttempts.
  return (ctx.job.attemptsMade ?? 0) + 1 >= maxAttempts;
}

export function recordJobStart(ctx: JobEventContext): void {
  try {
    Sentry.addBreadcrumb({
      category: 'bullmq.job',
      type: 'info',
      level: 'info',
      message: `job start: ${ctx.queueName}/${ctx.job.name}`,
      data: {
        queue: ctx.queueName,
        jobId: ctx.job.id,
        name: ctx.job.name,
        attemptsMade: ctx.job.attemptsMade ?? 0,
        data: ctx.job.data,
      },
    });
  } catch {
    // Observability nunca derruba processor.
  }
}

export function recordJobError(
  ctx: JobEventContext,
  err: unknown,
): void {
  const final = isFinalAttempt(ctx);
  const message = err instanceof Error ? err.message : String(err);
  try {
    Sentry.addBreadcrumb({
      category: 'bullmq.job',
      type: 'error',
      level: final ? 'error' : 'warning',
      message: final
        ? `job final fail: ${ctx.queueName}/${ctx.job.name}`
        : `job retry scheduled: ${ctx.queueName}/${ctx.job.name}`,
      data: {
        queue: ctx.queueName,
        jobId: ctx.job.id,
        name: ctx.job.name,
        attemptsMade: ctx.job.attemptsMade ?? 0,
        maxAttempts: ctx.job.opts?.attempts ?? 1,
        errorMessage: message,
        data: ctx.job.data,
      },
    });
    if (final) {
      Sentry.captureException(err, {
        tags: {
          queue: ctx.queueName,
          jobName: ctx.job.name,
          jobId: String(ctx.job.id ?? ''),
        },
        extra: {
          attemptsMade: ctx.job.attemptsMade ?? 0,
          maxAttempts: ctx.job.opts?.attempts ?? 1,
          data: ctx.job.data,
        },
      });
    }
  } catch {
    // ignore observability failures
  }
}
