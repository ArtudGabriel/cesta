import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { MercadonaAdapter } from './adapters/mercadona.adapter';
import { CatalogSyncController } from './catalog-sync.controller';
import {
  CATALOG_SYNC_QUEUE,
  CatalogSyncProcessor,
} from './catalog-sync.processor';
import { CatalogSyncRepository } from './catalog-sync.repository';
import { CatalogSyncService } from './catalog-sync.service';

@Module({
  imports: [BullModule.registerQueue({ name: CATALOG_SYNC_QUEUE })],
  controllers: [CatalogSyncController],
  providers: [
    CatalogSyncService,
    CatalogSyncRepository,
    CatalogSyncProcessor,
    MercadonaAdapter,
  ],
  exports: [CatalogSyncService],
})
export class CatalogSyncModule {}
