import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dtos/pagination.dto';

export class ReviewsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['recent', 'helpful', 'rating_desc', 'rating_asc'] })
  @IsOptional()
  @IsString()
  @IsIn(['recent', 'helpful', 'rating_desc', 'rating_asc'])
  sortBy?: 'recent' | 'helpful' | 'rating_desc' | 'rating_asc';
}
