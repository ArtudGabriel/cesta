import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { isBackfillImagesEnabled } from '../../common/config/is-backfill-enabled';
import { withBandwidthOptions } from '../../common/bullmq/worker-options';
import { BackfillImagesService } from './backfill-images.service';

// Sprint 133: processor BullMQ para pipeline Blob-only.
//  - `from-source` enqueued pelo CatalogSyncService quando adapter oficial
//    expôs raw.imageUrl e Product.imageUrl não aponta para Blob.
//  - `scan-and-backfill` cron 2h: varre Product.imageUrl=null + resolve
//    via OpenFoodFacts.
export const BACKFILL_IMAGES_QUEUE = 'backfill-images';

export type BackfillImagesJob =
  | { kind: 'scan-and-backfill'; limit?: number }
  | { kind: 'from-source'; productId: string; sourceUrl: string };

const DEFAULT_SCAN_LIMIT = 50;
const SCAN_CRON = '0 */2 * * *'; // a cada 2h (Europe/Madrid)

@Processor(BACKFILL_IMAGES_QUEUE, withBandwidthOptions({ concurrency: 1 }))
export class BackfillImagesProcessor
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(BackfillImagesProcessor.name);

  constructor(
    private readonly service: BackfillImagesService,
    @InjectQueue(BACKFILL_IMAGES_QUEUE)
    private readonly queue: Queue<BackfillImagesJob>,
  ) {
    super();
  }

  onModuleInit(): void {
    setImmediate(() => void this.scheduleCron());
  }

  private async scheduleCron(): Promise<void> {
    // Sprint 213 (ADR 0025): cron scan desabilitado por default em prod Render
    // (bandwidth mitigation). Remove scheduler remanescente de deploys antigos
    // pra evitar execução silenciosa. Habilitar via BACKFILL_IMAGES_ENABLED=true
    // em ambiente controlado (dev local OU workflow GitHub Actions dedicado).
    if (!isBackfillImagesEnabled(process.env.BACKFILL_IMAGES_ENABLED)) {
      try {
        await this.queue.removeJobScheduler('cron-backfill-images');
      } catch (err) {
        this.logger.warn(
          `Failed to remove stale backfill scheduler: ${(err as Error).message}`,
        );
      }
      this.logger.warn(
        'backfill-images cron disabled (BACKFILL_IMAGES_ENABLED!=true). ADR 0025.',
      );
      return;
    }

    try {
      await this.queue.add(
        'scan-and-backfill',
        { kind: 'scan-and-backfill' },
        {
          jobId: 'cron-backfill-images',
          repeat: { pattern: SCAN_CRON, tz: 'Europe/Madrid' },
          removeOnComplete: 50,
          removeOnFail: 50,
        },
      );
      this.logger.log(
        `Scheduled scan-and-backfill with cron "${SCAN_CRON}" (Europe/Madrid)`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to schedule scan-and-backfill: ${(err as Error).message}`,
      );
    }
  }

  async process(job: Job<BackfillImagesJob>): Promise<void> {
    const data = job.data;
    try {
      if (data.kind === 'scan-and-backfill') {
        const limit = data.limit ?? DEFAULT_SCAN_LIMIT;
        const stats = await this.service.scanAndBackfill(limit);
        this.logger.log(
          `scan-and-backfill done: ${JSON.stringify(stats)}`,
        );
        return;
      }
      const result = await this.service.backfillFromSource({
        productId: data.productId,
        sourceUrl: data.sourceUrl,
      });
      this.logger.log(
        `from-source ${data.productId}: ${result}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(`backfill-images failed: ${message}`, stack);
      throw err; // BullMQ marca failed → retry/visibilidade.
    }
  }
}
