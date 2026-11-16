import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class WebVitalDto {
  @ApiProperty({ enum: ['LCP', 'INP', 'CLS', 'FCP', 'TTFB', 'FID'] })
  @IsString()
  @IsIn(['LCP', 'INP', 'CLS', 'FCP', 'TTFB', 'FID'])
  metric!: string;

  @ApiProperty({ example: 1234.5 })
  @IsNumber()
  @Min(0)
  value!: number;

  @ApiProperty({ example: '/produto/abc123' })
  @IsString()
  @MaxLength(512)
  path!: string;

  @ApiProperty({ example: 1731791234567 })
  @IsNumber()
  ts!: number;

  @ApiProperty({ required: false, enum: ['good', 'needs-improvement', 'poor'] })
  @IsOptional()
  @IsString()
  @IsIn(['good', 'needs-improvement', 'poor'])
  rating?: string;
}
