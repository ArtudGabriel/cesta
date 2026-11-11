import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
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
  CatalogSyncProcessor,
} from './catalog-sync.processor';
import { CatalogSyncRepository } from './catalog-sync.repository';
import { CatalogSyncService } from './catalog-sync.service';

@Module({
  imports: [
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
export class CatalogSyncModule {}
