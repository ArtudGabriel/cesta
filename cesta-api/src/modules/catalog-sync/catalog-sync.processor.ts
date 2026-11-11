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
const SCHEDULE: Array<{ slug: string; cron: string }> = [
  { slug: 'mercadona', cron: '0 3 * * *' },
  { slug: 'carrefour', cron: '30 3 * * *' },
  { slug: 'alcampo', cron: '0 4 * * *' },
  { slug: 'dia', cron: '30 4 * * *' },
  { slug: 'froiz', cron: '0 5 * * 2' },
  { slug: 'lidl', cron: '0 6 * * 2' },
  { slug: 'aldi', cron: '0 7 * * 2' },
];

@Processor(CATALOG_SYNC_QUEUE)
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

  async onModuleInit(): Promise<void> {
    for (const entry of SCHEDULE) {
      const jobId = `cron:${entry.slug}`;
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
    }
  }

  async process(job: Job<CatalogSyncJob>): Promise<void> {
    const { supermarketSlug } = job.data;
    this.logger.log(`Running sync for ${supermarketSlug}`);
    await this.service.runFor(supermarketSlug);
  }
}
