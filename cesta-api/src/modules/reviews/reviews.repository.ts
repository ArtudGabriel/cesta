import { Injectable } from '@nestjs/common';
import { Prisma, Review, User } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ReviewsQueryDto } from './dtos/reviews-query.dto';

export type ReviewWithUser = Review & { user: User };

@Injectable()
export class ReviewsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<ReviewWithUser | null> {
    return this.prisma.review.findFirst({
      where: { id, deletedAt: null },
      include: { user: true },
    });
  }

  findByUserAndProduct(
    userId: string,
    productId: string,
  ): Promise<Review | null> {
    return this.prisma.review.findFirst({
      where: { userId, productId, deletedAt: null },
    });
  }

  async findByProduct(
    productId: string,
    query: ReviewsQueryDto,
  ): Promise<{ items: ReviewWithUser[]; total: number }> {
    const where: Prisma.ReviewWhereInput = { productId, deletedAt: null };
    const orderBy = this.buildOrderBy(query.sortBy);

    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy,
        skip: query.skip,
        take: query.limit,
        include: { user: true },
      }),
      this.prisma.review.count({ where }),
    ]);

    return { items, total };
  }

  async summary(
    productId: string,
  ): Promise<{ average: number; total: number; distribution: Record<1 | 2 | 3 | 4 | 5, number> }> {
    const where = { productId, deletedAt: null };
    const grouped = await this.prisma.review.groupBy({
      by: ['rating'],
      where,
      _count: { rating: true },
    });

    const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    let sum = 0;
    let total = 0;
    for (const row of grouped) {
      const count = row._count.rating;
      distribution[row.rating as 1 | 2 | 3 | 4 | 5] = count;
      sum += row.rating * count;
      total += count;
    }
    const average = total ? Math.round((sum / total) * 10) / 10 : 0;
    return { average, total, distribution };
  }

  create(data: Prisma.ReviewUncheckedCreateInput): Promise<ReviewWithUser> {
    return this.prisma.review.create({
      data,
      include: { user: true },
    });
  }

  update(
    id: string,
    data: Prisma.ReviewUpdateInput,
  ): Promise<ReviewWithUser> {
    return this.prisma.review.update({
      where: { id },
      data,
      include: { user: true },
    });
  }

  softDelete(id: string): Promise<Review> {
    return this.prisma.review.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async toggleHelpful(
    reviewId: string,
    userId: string,
  ): Promise<{ markedHelpful: boolean; helpfulCount: number }> {
    const existing = await this.prisma.reviewHelpful.findUnique({
      where: { reviewId_userId: { reviewId, userId } },
    });

    if (existing) {
      await this.prisma.reviewHelpful.delete({ where: { id: existing.id } });
      const updated = await this.prisma.review.update({
        where: { id: reviewId },
        data: { helpfulCount: { decrement: 1 } },
      });
      return {
        markedHelpful: false,
        helpfulCount: Math.max(0, updated.helpfulCount),
      };
    }

    await this.prisma.reviewHelpful.create({
      data: { reviewId, userId },
    });
    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: { helpfulCount: { increment: 1 } },
    });
    return { markedHelpful: true, helpfulCount: updated.helpfulCount };
  }

  async incrementReport(reviewId: string): Promise<void> {
    await this.prisma.review.update({
      where: { id: reviewId },
      data: { reportedCount: { increment: 1 } },
    });
  }

  async helpfulsByUser(
    userId: string,
    reviewIds: string[],
  ): Promise<Set<string>> {
    if (!reviewIds.length) return new Set();
    const rows = await this.prisma.reviewHelpful.findMany({
      where: { userId, reviewId: { in: reviewIds } },
      select: { reviewId: true },
    });
    return new Set(rows.map((r) => r.reviewId));
  }

  private buildOrderBy(
    sortBy: ReviewsQueryDto['sortBy'] = 'recent',
  ): Prisma.ReviewOrderByWithRelationInput[] {
    switch (sortBy) {
      case 'helpful':
        return [{ helpfulCount: 'desc' }, { createdAt: 'desc' }];
      case 'rating_desc':
        return [{ rating: 'desc' }, { createdAt: 'desc' }];
      case 'rating_asc':
        return [{ rating: 'asc' }, { createdAt: 'desc' }];
      case 'recent':
      default:
        return [{ createdAt: 'desc' }];
    }
  }
}
