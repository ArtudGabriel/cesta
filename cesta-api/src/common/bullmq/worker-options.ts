import type { WorkerOptions } from 'bullmq';

/**
 * Sprint 213 (ADR 0025) — WorkerOptions bandwidth-friendly.
 *
 * Context: Render Hobby bandwidth outbound 5.99GB/5GB esgotou. Redis BullMQ
 * contribui pra outbound via (a) BRPOPLPUSH blocking fetch when queue drain
 * (drainDelay=5s default → reconexão rápida), (b) stalled check periódico
 * (stalledInterval=30s default). Aumentar ambos reduz round-trips Redis sem
 * afetar correctness (crons são hourly/daily, não real-time).
 *
 * Trade-off: job retry pós-crash tarda até 120s (vs 30s antes). Aceitável:
 * nenhum worker é latency-critical (crons agendados horários/diários).
 *
 * Defaults BullMQ:
 * - drainDelay: 5s  → 30s   (6x menos reconexões em idle)
 * - stalledInterval: 30s → 120s  (4x menos SCAN stalled commands)
 */
export const BANDWIDTH_FRIENDLY_WORKER_OPTIONS: Pick<
  WorkerOptions,
  'drainDelay' | 'stalledInterval'
> = {
  drainDelay: 30,
  stalledInterval: 120_000,
};

/** Merge com opts específicas (concurrency etc.) do processor. */
export function withBandwidthOptions<T extends Partial<WorkerOptions>>(
  extra: T = {} as T,
): T & typeof BANDWIDTH_FRIENDLY_WORKER_OPTIONS {
  return { ...BANDWIDTH_FRIENDLY_WORKER_OPTIONS, ...extra };
}
