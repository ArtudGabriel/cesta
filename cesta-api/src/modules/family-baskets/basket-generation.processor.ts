import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { BasketGenerator } from './basket-generator';
import { FamilyProfilesService } from '../family-profiles/family-profiles.service';
import { FamilyBasketsRepository } from './family-baskets.repository';

export const BASKET_GENERATION_QUEUE = 'basket-generation';

export interface BasketGenerationJob {
  userId: string;
  basketId: string;
  preserveLocked: boolean;
}

@Processor(BASKET_GENERATION_QUEUE)
export class BasketGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(BasketGenerationProcessor.name);

  constructor(
    private readonly generator: BasketGenerator,
    private readonly profilesService: FamilyProfilesService,
    private readonly basketsRepo: FamilyBasketsRepository,
  ) {
    super();
  }

  async process(job: Job<BasketGenerationJob>): Promise<void> {
    const { userId, basketId, preserveLocked } = job.data;
    this.logger.log(`Generating basket ${basketId} for user ${userId}`);

    try {
      const profile = await this.profilesService.getOrThrow(userId);
      const existing = await this.basketsRepo.findByIdForUser(basketId, userId);

      const lockedExisting =
        preserveLocked && existing
          ? existing.items
              .filter((i) => i.isLocked || i.isRequired)
              .map((i) => ({
                productId: i.productId,
                quantity: Number(i.quantity),
                unitPrice: Number(i.unitPrice),
              }))
          : [];

      const items = await this.generator.generate({
        members: profile.members as never,
        answers: profile.answers as never,
        restrictions: profile.restrictions,
        blockedCategories: profile.blockedCategories,
        requiredProductIds: profile.requiredProductIds,
        lockedExisting,
      });

      const totalCost = items.reduce(
        (sum, i) => sum + i.unitPrice * i.quantity,
        0,
      );

      await this.basketsRepo.replaceItems(
        basketId,
        items,
        Math.round(totalCost * 100) / 100,
      );

      this.logger.log(
        `Basket ${basketId} ready: ${items.length} items, €${totalCost.toFixed(2)}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Basket ${basketId} failed: ${message}`);
      await this.basketsRepo.updateStatus(basketId, 'failed', message);
      throw error;
    }
  }
}
