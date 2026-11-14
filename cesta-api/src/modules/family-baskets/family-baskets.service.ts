import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import * as Sentry from '@sentry/node';
import { ProductsRepository } from '../products/products.repository';
import { FamilyProfilesService } from '../family-profiles/family-profiles.service';
import {
  AddBasketItemDto,
  UpdateBasketItemDto,
} from './dtos/basket-item.dto';
import { FamilyBasketResponseDto } from './dtos/basket-response.dto';
import { GenerateBasketResponseDto } from './dtos/generate-basket.dto';
import { FamilyBasketsRepository } from './family-baskets.repository';
import {
  BASKET_GENERATION_QUEUE,
  BasketGenerationJob,
} from './basket-generation.processor';

@Injectable()
export class FamilyBasketsService {
  constructor(
    private readonly repo: FamilyBasketsRepository,
    private readonly profilesService: FamilyProfilesService,
    private readonly productsRepo: ProductsRepository,
    @InjectQueue(BASKET_GENERATION_QUEUE)
    private readonly queue: Queue<BasketGenerationJob>,
  ) {}

  async generate(userId: string): Promise<GenerateBasketResponseDto> {
    const profile = await this.profilesService.getOrThrow(userId);
    const basket = await this.repo.createEmpty(userId, profile.id);

    const job = await Sentry.startSpan(
      { name: 'basket.generate.enqueue', op: 'queue.publish' },
      () =>
        this.queue.add('generate', {
          userId,
          basketId: basket.id,
          preserveLocked: false,
        }),
    );

    return {
      jobId: job.id ?? basket.id,
      status: 'queued',
      basketId: basket.id,
    };
  }

  async regenerate(
    userId: string,
    basketId: string,
  ): Promise<GenerateBasketResponseDto> {
    const basket = await this.repo.findByIdForUser(basketId, userId);
    if (!basket) throw new NotFoundException('Cesta não encontrada');

    await this.repo.updateStatus(basketId, 'pending');

    const job = await Sentry.startSpan(
      { name: 'basket.regenerate.enqueue', op: 'queue.publish' },
      () =>
        this.queue.add('regenerate', {
          userId,
          basketId,
          preserveLocked: true,
        }),
    );

    return {
      jobId: job.id ?? basketId,
      status: 'queued',
      basketId,
    };
  }

  async findOne(
    userId: string,
    basketId: string,
  ): Promise<FamilyBasketResponseDto> {
    const basket = await this.repo.findByIdForUser(basketId, userId);
    if (!basket) throw new NotFoundException('Cesta não encontrada');
    return FamilyBasketResponseDto.fromEntity(basket);
  }

  async findLatest(userId: string): Promise<FamilyBasketResponseDto | null> {
    const basket = await this.repo.findLatestByUser(userId);
    return basket ? FamilyBasketResponseDto.fromEntity(basket) : null;
  }

  async addItem(
    userId: string,
    basketId: string,
    dto: AddBasketItemDto,
  ): Promise<FamilyBasketResponseDto> {
    await this.assertOwner(userId, basketId);

    const product = await this.productsRepo.findById(dto.productId);
    if (!product) throw new NotFoundException('Produto não encontrado');

    const cheapestPrice =
      product.prices.length > 0
        ? Math.min(...product.prices.filter((p) => p.isAvailable).map((p) => Number(p.currentPrice)))
        : 0;

    if (cheapestPrice <= 0)
      throw new BadRequestException('Produto sem preço disponível');

    await this.repo.addOrUpdateItem(basketId, dto.productId, dto.quantity ?? 1, cheapestPrice, {
      isRequired: dto.isRequired,
      isLocked: dto.isLocked,
    });

    return this.findOne(userId, basketId);
  }

  async updateItem(
    userId: string,
    basketId: string,
    itemId: string,
    dto: UpdateBasketItemDto,
  ): Promise<FamilyBasketResponseDto> {
    await this.assertItemOwner(userId, itemId);
    await this.repo.updateItem(itemId, dto);
    return this.findOne(userId, basketId);
  }

  async removeItem(
    userId: string,
    basketId: string,
    itemId: string,
  ): Promise<FamilyBasketResponseDto> {
    await this.assertItemOwner(userId, itemId);
    await this.repo.removeItem(itemId);
    return this.findOne(userId, basketId);
  }

  private async assertOwner(userId: string, basketId: string): Promise<void> {
    const basket = await this.repo.findByIdForUser(basketId, userId);
    if (!basket) throw new ForbiddenException('Cesta não acessível');
  }

  private async assertItemOwner(
    userId: string,
    itemId: string,
  ): Promise<void> {
    const item = await this.repo.findItemForUser(itemId, userId);
    if (!item) throw new ForbiddenException('Item não acessível');
  }
}
