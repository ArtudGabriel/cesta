import { ApiProperty } from '@nestjs/swagger';

export class ExpenseSummaryDto {
  @ApiProperty({ enum: ['day', 'week', 'month'] }) period: 'day' | 'week' | 'month';
  @ApiProperty() from: Date;
  @ApiProperty() to: Date;
  @ApiProperty({ description: 'Total gasto no período (€)' }) total: number;
  @ApiProperty({ description: 'Quantidade de notas no período' }) count: number;
  @ApiProperty({ description: 'Total do período anterior (€)' }) previousTotal: number;
  @ApiProperty({ description: 'Variação % vs período anterior (1 casa decimal)' }) deltaPct: number;
}

export class ExpenseBucketDto {
  @ApiProperty({ description: 'Categoria ou nome de supermercado' }) label: string;
  @ApiProperty({ description: 'Total agregado (€)' }) total: number;
  @ApiProperty({ description: 'Quantidade de itens ou notas' }) count: number;
}

export class ExpenseTopProductDto {
  @ApiProperty({ type: String, nullable: true, description: 'null quando produto não vinculado (OCR raw)' })
  productId: string | null;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) imageUrl: string | null;
  @ApiProperty({ description: 'Total gasto no produto (€)' }) total: number;
  @ApiProperty({ description: 'Quantidade acumulada (máx 3 casas decimais)' }) quantity: number;
}
