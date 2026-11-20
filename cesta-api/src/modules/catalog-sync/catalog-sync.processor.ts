import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { CatalogSyncService } from './catalog-sync.service';

export const CATALOG_SYNC_QUEUE = 'catalog-sync';

export interface CatalogSyncJob {
  supermarketSlug: string;
}

// Agendamento — cron em Europe/Madrid. Espaçamento de 30min entre runs pra
// aliviar DB. Froiz/LIDL/Aldi são semanais (terça) porque dependem de
// scraping/folleto que não muda diariamente.
// Sprint 134: Puppeteer slugs (carrefour, alcampo) reativados após upgrade
// Render Starter (2 GB RAM) aprovado pelo user em 2026-11-20. ADR 0009
// documenta decisão + custo US$ 7/mo. Eroski usa bareFetch (S125).
const SCHEDULE: Array<{ slug: string; cron: string }> = [
  { slug: 'mercadona', cron: '0 3 * * *' },
  { slug: 'carrefour', cron: '30 3 * * *' },
  { slug: 'alcampo', cron: '0 4 * * *' },
  { slug: 'dia', cron: '30 4 * * *' },
  { slug: 'eroski', cron: '0 5 * * *' },
  { slug: 'froiz', cron: '0 6 * * 2' },
  { slug: 'lidl', cron: '0 6 * * 2' },
  { slug: 'aldi', cron: '0 7 * * 2' },
];

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
    for (const entry of SCHEDULE) {
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
    this.logger.log(`Running sync for ${supermarketSlug} (jobId=${job.id ?? '?'})`);
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
      throw err; // Mantém BullMQ marcando como failed pra retry/visibilidade.
    }
  }
}
