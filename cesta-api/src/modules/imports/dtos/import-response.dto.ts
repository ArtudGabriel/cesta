import { ApiProperty } from '@nestjs/swagger';
import { Import } from '@prisma/client';

export type ImportStatus =
  | 'pending'
  | 'parsing'
  | 'ready_to_apply'
  | 'applying'
  | 'complete'
  | 'failed';

export interface ImportSummary {
  added: {
    favoritos: number;
    listas: number;
    listaItems: number;
    alertas: number;
    reviews: number;
    expenses: number;
    expenseItems: number;
  };
  skipped: {
    favoritos: number;
    listas: number;
    alertas: number;
    reviews: number;
    productsNotFound: number;
  };
  errors: Array<{ file: string; line: number; message: string }>;
}

export class ImportResponseDto {
  @ApiProperty() jobId!: string;
  @ApiProperty() status!: ImportStatus;
  @ApiProperty() dryRun!: boolean;
  @ApiProperty({ required: false, nullable: true }) errorMessage!: string | null;
  @ApiProperty({ required: false, nullable: true }) summary!: ImportSummary | null;
  @ApiProperty() createdAt!: string;

  static fromEntity(row: Import): ImportResponseDto {
    const dto = new ImportResponseDto();
    dto.jobId = row.id;
    dto.status = row.status as ImportStatus;
    dto.dryRun = row.dryRun;
    dto.errorMessage = row.errorMessage;
    dto.summary = (row.summary as unknown as ImportSummary | null) ?? null;
    dto.createdAt = row.createdAt.toISOString();
    return dto;
  }
}
