import { ApiProperty } from '@nestjs/swagger';
import { Review, User } from '@prisma/client';

export class ReviewResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() productId: string;
  @ApiProperty() rating: number;
  @ApiProperty({ nullable: true }) comment: string | null;
  @ApiProperty() helpfulCount: number;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiProperty() authorId: string;
  @ApiProperty({ nullable: true }) authorName: string | null;
  @ApiProperty({ default: false, description: 'Se o usuário atual marcou útil' })
  markedHelpful: boolean;

  static fromEntity(
    review: Review & { user: User },
    markedHelpful = false,
  ): ReviewResponseDto {
    const dto = new ReviewResponseDto();
    dto.id = review.id;
    dto.productId = review.productId;
    dto.rating = review.rating;
    dto.comment = review.comment;
    dto.helpfulCount = review.helpfulCount;
    dto.createdAt = review.createdAt;
    dto.updatedAt = review.updatedAt;
    dto.authorId = review.userId;
    dto.authorName = review.user?.name ?? null;
    dto.markedHelpful = markedHelpful;
    return dto;
  }
}

export class ReviewSummaryDto {
  @ApiProperty({ example: 4.3 }) average: number;
  @ApiProperty() total: number;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}
