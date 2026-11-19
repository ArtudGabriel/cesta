import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Logger, Module, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import { RevalidateModule } from '../../common/revalidate/revalidate.module';
import { PRICE_ALERTS_QUEUE } from '../alerts/alerts.processor';
import { AlcampoAdapter } from './adapters/alcampo.adapter';
import { AldiAdapter } from './adapters/aldi.adapter';
import { CarrefourAdapter } from './adapters/carrefour.adapter';
import { DiaAdapter } from './adapters/dia.adapter';
import { FroizAdapter } from './adapters/froiz.adapter';
import { LidlAdapter } from './adapters/lidl.adapter';
import { MercadonaAdapter } from './adapters/mercadona.adapter';
import { CatalogSyncController } from './catalog-sync.controller';
import {
  CATALOG_SYNC_QUEUE,
  CatalogSyncJob,
  CatalogSyncProcessor,
} from './catalog-sync.processor';
import { CatalogSyncRepository } from './catalog-sync.repository';
import { CatalogSyncService } from './catalog-sync.service';

@Module({
  imports: [
    RevalidateModule,
    BullModule.registerQueue(
      { name: CATALOG_SYNC_QUEUE },
      { name: PRICE_ALERTS_QUEUE },
    ),
  ],
  controllers: [CatalogSyncController],
  providers: [
    CatalogSyncService,
    CatalogSyncRepository,
    CatalogSyncProcessor,
    MercadonaAdapter,
    CarrefourAdapter,
    AlcampoAdapter,
    DiaAdapter,
    FroizAdapter,
    LidlAdapter,
    AldiAdapter,
  ],
  exports: [CatalogSyncService],
})
export class CatalogSyncModule implements OnApplicationBootstrap {
  private readonly logger = new Logger(CatalogSyncModule.name);

  constructor(
    @InjectQueue(CATALOG_SYNC_QUEUE)
    private readonly queue: Queue<CatalogSyncJob>,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.AUTO_SYNC_ON_BOOT !== 'true') return;
    // Fire-and-forget: await bloqueia app.listen() se Redis estiver latente
    // na boot window (S109 hotfix — Render port scan timeout após 5min).
    this.queue
      .add(
        'bootstrap-sync',
        { supermarketSlug: 'mercadona' },
        { jobId: 'bootstrap:mercadona', removeOnComplete: 10, removeOnFail: 10 },
      )
      .then(() =>
        this.logger.log(
          'AUTO_SYNC_ON_BOOT=true → enqueued bootstrap-sync mercadona',
        ),
      )
      .catch((err: unknown) =>
        this.logger.error(
          `AUTO_SYNC_ON_BOOT enqueue failed: ${(err as Error).message}`,
        ),
      );
  }
}
