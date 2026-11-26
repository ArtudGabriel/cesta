import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';
import { SEARCH_PATTERN } from './product-filters.dto';

// ──────────────────────────────────────────────────────────────────────
// Sprint 106 — Zod schema boundary API↔Front para /products/search
// Shape definido em openapi/products-search.yaml. Validation no boundary:
// o controller faz safeParse e lança BadRequestException em erro.
// ──────────────────────────────────────────────────────────────────────

export const productSearchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(2, 'q deve ter no mínimo 2 caracteres')
    .max(128, 'q excede 128 caracteres')
    .regex(SEARCH_PATTERN, 'q contém caracteres inválidos'),
  limit: z.coerce.number().int().min(1).max(10).default(10),
});

export type ProductSearchQuery = z.infer<typeof productSearchQuerySchema>;

export class ProductSearchItemDto {
  @ApiProperty({ description: 'cuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) imageUrl: string | null;
  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Menor preço unitário em €. null quando produto não tem oferta ativa.',
  })
  cheapestUnitPrice: number | null;
}

export class ProductSearchResponseDto {
  @ApiProperty({ type: [ProductSearchItemDto] })
  items: ProductSearchItemDto[];

  @ApiProperty() total: number;
}
