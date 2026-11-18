import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class CreateImportDto {
  @ApiPropertyOptional({
    default: true,
    description: 'true=dry-run preview only; false=apply direct após parse',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() !== 'false';
    return true;
  })
  @IsBoolean()
  dryRun?: boolean;
}
