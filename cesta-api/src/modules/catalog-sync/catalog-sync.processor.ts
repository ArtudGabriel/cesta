import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { CatalogSyncService } from './catalog-sync.service';
import {
  recordJobStart,
  recordJobError,
} from '../../common/sentry/processor-observability';

export const CATALOG_SYNC_QUEUE = 'catalog-sync';
// Sprint 134-r (2ª iteração): queue separada para manual triggers via
// POST /admin/catalog-sync/:slug/run. Priority=1 em cima do cron queue
// não resolveu porque concurrency=3 ficava saturada por repeats
// long-running (Mercadona ~24min). Queue dedicada = slot sempre livre.
export const CATALOG_SYNC_MANUAL_QUEUE = 'catalog-sync-manual';

export interface CatalogSyncJob {
  supermarketSlug: string;
}

// Agendamento — cron em Europe/Madrid. Espaçamento de 30min entre runs pra
// aliviar DB. Froiz/LIDL/Aldi são semanais (terça) porque dependem de
// scraping/folleto que não muda diariamente.
// Sprint 138: Carrefour + Alcampo voltaram a usar Puppeteer, mas só em
// scripts locais (`npm run sync:carrefour|sync:alcampo`). Prod cron fica
// OFF pra esses slugs (OOM Chromium × 512MB Render), a menos que
// CARREFOUR_ALCAMPO_CRON_ENABLED=true override explícito seja setado.
// Eroski também precisa rodar local (CDN bloqueia datacenter IP, S137).
const PUPPETEER_CRON_SLUGS = new Set(['carrefour', 'alcampo']);

const FULL_SCHEDULE: Array<{ slug: string; cron: string }> = [
  { slug: 'mercadona', cron: '0 3 * * *' },
  { slug: 'carrefour', cron: '30 3 * * *' },
  { slug: 'alcampo', cron: '0 4 * * *' },
  { slug: 'dia', cron: '30 4 * * *' },
  { slug: 'eroski', cron: '0 5 * * *' },
  { slug: 'froiz', cron: '0 6 * * 2' },
  { slug: 'lidl', cron: '0 6 * * 2' },
  { slug: 'aldi', cron: '0 7 * * 2' },
];

function activeSchedule(): Array<{ slug: string; cron: string }> {
  if (process.env.CARREFOUR_ALCAMPO_CRON_ENABLED === 'true') {
    return FULL_SCHEDULE;
  }
  return FULL_SCHEDULE.filter((entry) => !PUPPETEER_CRON_SLUGS.has(entry.slug));
}

// Sprint 119 follow-up: concurrency=3 permite adapters distintos rodarem em
// paralelo (Mercadona + Carrefour + outro). Com concurrency=1 default, cada
// deploy re-enfileira bootstrap-sync mercadona (S115: sem jobId) e Carrefour
// ficava stuck atrás de N Mercadona runs de ~24min cada. Adapter cada tem
// rate-limit interno (politeFetch jitter 1-7s), então paralelizar não causa
// cross-contamination de HTTP contra um único mercado.
@Processor(CATALOG_SYNC_QUEUE, { concurrency: 3 })
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
    const skipped = FULL_SCHEDULE.filter((e) => !schedule.includes(e));
    if (skipped.length > 0) {
      this.logger.warn(
        `Puppeteer slugs disabled (Render 512MB OOM) — skipping crons: ${skipped
          .map((e) => e.slug)
          .join(',')}. Override: CARREFOUR_ALCAMPO_CRON_ENABLED=true`,
      );
    }
    // Sprint 138: removedRepeatable pra qualquer cron que saiu do schedule.
    // BullMQ persiste repeatables no Redis — deploy anterior que agendou
    // carrefour/alcampo continuaria disparando mesmo com schedule filtrado.
    for (const dead of skipped) {
      const jobId = `cron-${dead.slug}`;
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
        await this.queue.add(
          'scheduled-sync',
          { supermarketSlug: entry.slug },
          {
            jobId,
            repeat: { pattern: entry.cron, tz: 'Europe/Madrid' },
            removeOnComplete: 50,
            removeOnFail: 50,
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
@Processor(CATALOG_SYNC_MANUAL_QUEUE, { concurrency: 2 })
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
