import { ApiProperty } from '@nestjs/swagger';
import { SyncRun } from '@prisma/client';

export class AdapterListResponseDto {
  @ApiProperty({ type: [String], description: 'Slugs dos adapters registrados' })
  adapters: string[];
}

export class CatalogSyncJobResponseDto {
  @ApiProperty({ nullable: true, description: 'ID do job BullMQ enfileirado' })
  jobId: string | null;
  @ApiProperty({ example: 'queued' }) status: string;
  @ApiProperty() supermarketSlug: string;
}

export class SyncRunResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() supermarketSlug: string;
  @ApiProperty({ enum: ['running', 'success', 'partial', 'failed'] })
  status: string;
  @ApiProperty() itemsProcessed: number;
  @ApiProperty() itemsCreated: number;
  @ApiProperty() itemsUpdated: number;
  @ApiProperty() itemsCandidate: number;
  @ApiProperty() itemsFailed: number;
  @ApiProperty({ nullable: true }) errorMessage: string | null;
  @ApiProperty() startedAt: Date;
  @ApiProperty({ nullable: true }) finishedAt: Date | null;

  static fromEntity(run: SyncRun): SyncRunResponseDto {
    const dto = new SyncRunResponseDto();
    dto.id = run.id;
    dto.supermarketSlug = run.supermarketSlug;
    dto.status = run.status;
    dto.itemsProcessed = run.itemsProcessed;
    dto.itemsCreated = run.itemsCreated;
    dto.itemsUpdated = run.itemsUpdated;
    dto.itemsCandidate = run.itemsCandidate;
    dto.itemsFailed = run.itemsFailed;
    dto.errorMessage = run.errorMessage;
    dto.startedAt = run.startedAt;
    dto.finishedAt = run.finishedAt;
    return dto;
  }
}
