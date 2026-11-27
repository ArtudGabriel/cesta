import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { CatalogSyncService } from './catalog-sync.service';
import {
  recordJobStart,
  recordJobError,
} from '../../common/sentry/processor-observability';
import { withBandwidthOptions } from '../../common/bullmq/worker-options';
import {
  FULL_SCHEDULE,
  RETIRED_SLUGS,
  SCHEDULED_CRON_JOB_OPTIONS,
  activeSchedule,
} from './catalog-sync.schedule';

// Re-export pra manter compatibilidade com imports existentes (main.ts,
// controller, module). S225: fonte da verdade mudou pra ./catalog-sync.schedule.
export { FULL_SCHEDULE, RETIRED_SLUGS, activeSchedule };

export const CATALOG_SYNC_QUEUE = 'catalog-sync';
// Sprint 134-r (2ª iteração): queue separada para manual triggers via
// POST /admin/catalog-sync/:slug/run. Priority=1 em cima do cron queue
// não resolveu porque concurrency=3 ficava saturada por repeats
// long-running (Mercadona ~24min). Queue dedicada = slot sempre livre.
export const CATALOG_SYNC_MANUAL_QUEUE = 'catalog-sync-manual';

export interface CatalogSyncJob {
  supermarketSlug: string;
}

// Agendamento — ver ./catalog-sync.schedule (ADR 0033 S225). Froiz semanal
// (terça) · Mercadona/DIA/Eroski/LIDL/Aldi diários · Carrefour/Alcampo
// RETIRED (S213 ADR 0025).

// Sprint 119 follow-up: concurrency=3 permite adapters distintos rodarem em
// paralelo (Mercadona + Carrefour + outro). Com concurrency=1 default, cada
// deploy re-enfileira bootstrap-sync mercadona (S115: sem jobId) e Carrefour
// ficava stuck atrás de N Mercadona runs de ~24min cada. Adapter cada tem
// rate-limit interno (politeFetch jitter 1-7s), então paralelizar não causa
// cross-contamination de HTTP contra um único mercado.
@Processor(CATALOG_SYNC_QUEUE, withBandwidthOptions({ concurrency: 3 }))
export class CatalogSyncProcessor
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(CatalogSyncProcessor.name);

  constructor(
    private readonly service: CatalogSyncService,
    @InjectQueue(CATALOG_SYNC_QUEUE)
    private readonly queue: Queue<CatalogSyncJob>,
  ) {
    super();
  }

  onModuleInit(): void {
    setImmediate(() => void this.scheduleCrons());
  }

  private async scheduleCrons(): Promise<void> {
    const schedule = activeSchedule();
    if (RETIRED_SLUGS.length > 0) {
      this.logger.warn(
        `Retired cron slugs (Sprint 213 bandwidth mitigation): ${RETIRED_SLUGS.join(
          ',',
        )}. Manual sync via npm run sync:<slug>.`,
      );
    }
    // Sprint 138/213: removedRepeatable pra qualquer cron que saiu do schedule.
    // BullMQ persiste repeatables no Redis — deploy anterior que agendou
    // carrefour/alcampo continuaria disparando mesmo com schedule filtrado.
    for (const slug of RETIRED_SLUGS) {
      const jobId = `cron-${slug}`;
      try {
        await this.queue.removeJobScheduler(jobId);
      } catch (err) {
        this.logger.warn(
          `Failed to remove stale scheduler ${jobId}: ${(err as Error).message}`,
        );
      }
    }
    for (const entry of schedule) {
      const jobId = `cron-${entry.slug}`;
      try {
        // Sprint 241 (#6): SCHEDULED_CRON_JOB_OPTIONS adiciona attempts=3 +
        // exponential backoff 5/10/20min. Transiente de 1 ciclo deixa de
        // guarantir 24h de staleness.
        await this.queue.add(
          'scheduled-sync',
          { supermarketSlug: entry.slug },
          {
            jobId,
            repeat: { pattern: entry.cron, tz: 'Europe/Madrid' },
            ...SCHEDULED_CRON_JOB_OPTIONS,
          },
        );
        this.logger.log(`Scheduled ${entry.slug} with cron "${entry.cron}"`);
      } catch (err) {
        this.logger.error(`Failed to schedule ${entry.slug}: ${(err as Error).message}`);
      }
    }
  }

  async process(job: Job<CatalogSyncJob>): Promise<void> {
    const { supermarketSlug } = job.data;
    this.logger.log(
      `Running cron sync for ${supermarketSlug} (jobId=${job.id ?? '?'} priority=${job.opts?.priority ?? 0})`,
    );
    recordJobStart({ queueName: CATALOG_SYNC_QUEUE, job });
    try {
      const result = await this.service.runFor(supermarketSlug);
      this.logger.log(
        `Sync ${supermarketSlug} done: ${JSON.stringify(result)}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(
        `Sync ${supermarketSlug} failed: ${message}`,
        stack,
      );
      recordJobError({ queueName: CATALOG_SYNC_QUEUE, job }, err);
      throw err; // Mantém BullMQ marcando como failed pra retry/visibilidade.
    }
  }
}

// Worker dedicado pra manual-sync: queue separada = zero contenção com
// repeat crons. concurrency=2 permite dois triggers paralelos mas não
// mais (adapter rate-limit interno + DB upsert).
@Processor(CATALOG_SYNC_MANUAL_QUEUE, withBandwidthOptions({ concurrency: 2 }))
export class CatalogSyncManualProcessor extends WorkerHost {
  private readonly logger = new Logger(CatalogSyncManualProcessor.name);

  constructor(private readonly service: CatalogSyncService) {
    super();
  }

  async process(job: Job<CatalogSyncJob>): Promise<void> {
    const { supermarketSlug } = job.data;
    this.logger.log(
      `Running manual sync for ${supermarketSlug} (jobId=${job.id ?? '?'})`,
    );
    recordJobStart({ queueName: CATALOG_SYNC_MANUAL_QUEUE, job });
    try {
      const result = await this.service.runFor(supermarketSlug);
      this.logger.log(
        `Manual sync ${supermarketSlug} done: ${JSON.stringify(result)}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(
        `Manual sync ${supermarketSlug} failed: ${message}`,
        stack,
      );
      recordJobError({ queueName: CATALOG_SYNC_MANUAL_QUEUE, job }, err);
      throw err;
    }
  }
}
