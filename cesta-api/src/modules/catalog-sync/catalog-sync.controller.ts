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
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Queue } from 'bullmq';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CATALOG_SYNC_MANUAL_QUEUE,
  CatalogSyncJob,
} from './catalog-sync.processor';
import { CatalogSyncService } from './catalog-sync.service';
import {
  AdapterListResponseDto,
  CatalogSyncJobResponseDto,
  SyncRunResponseDto,
} from './dtos/catalog-sync-response.dto';

/**
 * Sprint 207 — @ApiResponse coverage expand catalog-sync (ADR 0021 10→13).
 * Admin-only surface. Trigger run retorna 202 (job BullMQ queue dedicada
 * CATALOG_SYNC_MANUAL_QUEUE). Priority=1 sobre cron queue não resolveu
 * (adapters long-running saturam workers) — queue separada = slot livre.
 */
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
  @ApiOkResponse({ type: AdapterListResponseDto })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  @ApiForbiddenResponse({ description: 'Requer role admin' })
  listAdapters() {
    return { adapters: this.service.listAdapters() };
  }

  @Roles('admin')
  @Post(':slug/run')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Dispara sync manual (async)' })
  @ApiAcceptedResponse({
    type: CatalogSyncJobResponseDto,
    description:
      'Job enfileirado em CATALOG_SYNC_MANUAL_QUEUE. Status via GET /admin/catalog-sync/runs?supermarket=<slug>.',
  })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  @ApiForbiddenResponse({ description: 'Requer role admin' })
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
  @ApiQuery({ name: 'supermarket', required: false, description: 'Filtra por slug' })
  @ApiOkResponse({ type: [SyncRunResponseDto] })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  @ApiForbiddenResponse({ description: 'Requer role admin' })
  listRuns(@Query('supermarket') supermarket?: string) {
    return this.service.listRuns(supermarket);
  }
}
