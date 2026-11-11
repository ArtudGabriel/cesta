import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductsRepository } from '../products/products.repository';
import { CreateReviewDto, UpdateReviewDto } from './dtos/create-review.dto';
import {
  ReviewResponseDto,
  ReviewSummaryDto,
} from './dtos/review-response.dto';
import { ReviewsQueryDto } from './dtos/reviews-query.dto';
import { ReviewsRepository } from './reviews.repository';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly repo: ReviewsRepository,
    private readonly productsRepo: ProductsRepository,
  ) {}

  async create(
    userId: string,
    dto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    const product = await this.productsRepo.findById(dto.productId);
    if (!product)
      throw new NotFoundException(`Produto "${dto.productId}" não encontrado`);

    const existing = await this.repo.findByUserAndProduct(userId, dto.productId);
    if (existing)
      throw new ConflictException('Você já avaliou este produto. Edite sua avaliação.');

    const review = await this.repo.create({
      userId,
      productId: dto.productId,
      rating: dto.rating,
      comment: dto.comment ?? null,
    });
    return ReviewResponseDto.fromEntity(review);
  }

  async update(
    userId: string,
    reviewId: string,
    dto: UpdateReviewDto,
  ): Promise<ReviewResponseDto> {
    const review = await this.repo.findById(reviewId);
    if (!review) throw new NotFoundException(`Review "${reviewId}" não encontrado`);
    if (review.userId !== userId)
      throw new ForbiddenException('Você só pode editar suas próprias avaliações');

    const updated = await this.repo.update(reviewId, {
      rating: dto.rating,
      comment: dto.comment,
    });
    return ReviewResponseDto.fromEntity(updated);
  }

  async remove(userId: string, reviewId: string): Promise<void> {
    const review = await this.repo.findById(reviewId);
    if (!review) throw new NotFoundException(`Review "${reviewId}" não encontrado`);
    if (review.userId !== userId)
      throw new ForbiddenException('Você só pode excluir suas próprias avaliações');

    await this.repo.softDelete(reviewId);
  }

  async findByProduct(
    productId: string,
    query: ReviewsQueryDto,
    currentUserId?: string,
  ) {
    const { items, total } = await this.repo.findByProduct(productId, query);
    const helpfulSet = currentUserId
      ? await this.repo.helpfulsByUser(
          currentUserId,
          items.map((r) => r.id),
        )
      : new Set<string>();

    const mapped = items.map((r) =>
      ReviewResponseDto.fromEntity(r, helpfulSet.has(r.id)),
    );
    return { items: mapped, total, page: query.page, limit: query.limit };
  }

  summary(productId: string): Promise<ReviewSummaryDto> {
    return this.repo.summary(productId);
  }

  async toggleHelpful(
    userId: string,
    reviewId: string,
  ): Promise<{ markedHelpful: boolean; helpfulCount: number }> {
    const review = await this.repo.findById(reviewId);
    if (!review) throw new NotFoundException(`Review "${reviewId}" não encontrado`);
    if (review.userId === userId)
      throw new ForbiddenException('Você não pode marcar útil sua própria avaliação');

    return this.repo.toggleHelpful(reviewId, userId);
  }

  async report(userId: string, reviewId: string): Promise<void> {
    const review = await this.repo.findById(reviewId);
    if (!review) throw new NotFoundException(`Review "${reviewId}" não encontrado`);
    if (review.userId === userId)
      throw new ForbiddenException('Você não pode reportar sua própria avaliação');
    await this.repo.incrementReport(reviewId);
  }

  async findMine(userId: string, productId: string): Promise<ReviewResponseDto | null> {
    const review = await this.repo.findByUserAndProduct(userId, productId);
    if (!review) return null;
    const withUser = await this.repo.findById(review.id);
    if (!withUser) return null;
    return ReviewResponseDto.fromEntity(withUser);
  }
}
