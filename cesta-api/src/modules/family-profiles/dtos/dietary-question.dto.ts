import { ApiProperty } from '@nestjs/swagger';
import { DietaryQuestion } from '@prisma/client';

export class DietaryQuestionDto {
  @ApiProperty() id: string;
  @ApiProperty() key: string;
  @ApiProperty() labelEs: string;
  @ApiProperty() labelPt: string;
  @ApiProperty({ enum: ['boolean', 'choice'] }) type: string;
  @ApiProperty({ nullable: true, type: 'array', items: { type: 'object' } })
  options: Array<{ value: string; labelEs: string; labelPt: string }> | null;
  @ApiProperty({ nullable: true }) category: string | null;
  @ApiProperty() order: number;

  static fromEntity(q: DietaryQuestion): DietaryQuestionDto {
    const dto = new DietaryQuestionDto();
    dto.id = q.id;
    dto.key = q.key;
    dto.labelEs = q.labelEs;
    dto.labelPt = q.labelPt;
    dto.type = q.type;
    dto.options = q.options as DietaryQuestionDto['options'];
    dto.category = q.category;
    dto.order = q.order;
    return dto;
  }
}
