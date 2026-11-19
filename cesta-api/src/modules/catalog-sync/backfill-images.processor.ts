import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { BackfillImagesService } from './backfill-images.service';

export const BACKFILL_IMAGES_QUEUE = 'backfill-images';

// Sprint 117: Dois tipos de job na mesma queue.
//  - `scan-and-backfill`: cron 2h, varre Product.imageUrl=null, resolve via OFF.
//  - `from-source`: enfileirado pelo catalog-sync quando adapter oficial já
//    forneceu thumbnail (Mercadona `product.thumbnail`). Pula a resolução.
export interface BackfillScanJob {
  kind: 'scan-and-backfill';
  limit: number;
}
export interface BackfillFromSourceJob {
  kind: 'from-source';
  productId: string;
  sourceUrl: string;
}
export type BackfillImagesJob = BackfillScanJob | BackfillFromSourceJob;

const CRON_PATTERN = '0 */2 * * *'; // a cada 2h, minuto 0
const SCAN_LIMIT = 50;

@Processor(BACKFILL_IMAGES_QUEUE)
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
    const jobId = 'cron-backfill-images';
    try {
      await this.queue.add(
        'scheduled-scan',
        { kind: 'scan-and-backfill', limit: SCAN_LIMIT },
        {
          jobId,
          repeat: { pattern: CRON_PATTERN, tz: 'Europe/Madrid' },
          removeOnComplete: 50,
          removeOnFail: 50,
        },
      );
      this.logger.log(`Scheduled backfill-images with cron "${CRON_PATTERN}"`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to schedule backfill-images: ${message}`);
    }
  }

  async process(job: Job<BackfillImagesJob>): Promise<void> {
    const data = job.data;
    if (data.kind === 'scan-and-backfill') {
      this.logger.log(`tick scan-and-backfill limit=${data.limit}`);
      const stats = await this.service.scanAndBackfill(data.limit);
      this.logger.log(`tick done: ${JSON.stringify(stats)}`);
      return;
    }
    if (data.kind === 'from-source') {
      this.logger.log(
        `tick from-source product=${data.productId} src=${data.sourceUrl}`,
      );
      const result = await this.service.backfillFromSource({
        productId: data.productId,
        sourceUrl: data.sourceUrl,
      });
      this.logger.log(`tick done: ${result}`);
      return;
    }
    this.logger.warn(`Job kind desconhecido: ${JSON.stringify(data)}`);
  }
}
