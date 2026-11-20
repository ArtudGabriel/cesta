import { InjectQueue } from '@nestjs/bullmq';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Queue } from 'bullmq';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CATALOG_SYNC_MANUAL_QUEUE,
  CatalogSyncJob,
} from './catalog-sync.processor';
import { CatalogSyncService } from './catalog-sync.service';

@ApiTags('Catalog Sync')
@ApiBearerAuth()
@Controller('admin/catalog-sync')
export class CatalogSyncController {
  constructor(
    private readonly service: CatalogSyncService,
    @InjectQueue(CATALOG_SYNC_MANUAL_QUEUE)
    private readonly queue: Queue<CatalogSyncJob>,
  ) {}

  @Roles('admin')
  @Get('adapters')
  @ApiOperation({ summary: 'Adapters registrados' })
  listAdapters() {
    return { adapters: this.service.listAdapters() };
  }

  @Roles('admin')
  @Post(':slug/run')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Dispara sync manual (async)' })
  async runNow(@Param('slug') slug: string) {
    // Sprint 134-r (2ª iteração): queue dedicada CATALOG_SYNC_MANUAL_QUEUE
    // com worker próprio concurrency=2. Priority=1 em cima do cron queue
    // (1ª iteração) não resolveu: workers ficavam saturados por repeats
    // long-running (Mercadona ~24min) e priority só muda ordem, não
    // preempta slot. Queue separada = slot sempre livre pra admin trigger.
    const job = await this.queue.add(
      'manual-sync',
      { supermarketSlug: slug },
      { removeOnComplete: 50, removeOnFail: 50 },
    );
    return { jobId: job.id, status: 'queued', supermarketSlug: slug };
  }

  @Roles('admin')
  @Get('runs')
  @ApiOperation({ summary: 'Histórico de execuções' })
  listRuns(@Query('supermarket') supermarket?: string) {
    return this.service.listRuns(supermarket);
  }
}
