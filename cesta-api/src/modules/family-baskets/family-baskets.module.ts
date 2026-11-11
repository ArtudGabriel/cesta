import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { FamilyProfilesModule } from '../family-profiles/family-profiles.module';
import { ProductsRepository } from '../products/products.repository';
import { BasketGenerationProcessor, BASKET_GENERATION_QUEUE } from './basket-generation.processor';
import { BasketGenerator } from './basket-generator';
import { FamilyBasketsController } from './family-baskets.controller';
import { FamilyBasketsRepository } from './family-baskets.repository';
import { FamilyBasketsService } from './family-baskets.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: BASKET_GENERATION_QUEUE }),
    FamilyProfilesModule,
  ],
  controllers: [FamilyBasketsController],
  providers: [
    FamilyBasketsService,
    FamilyBasketsRepository,
    BasketGenerator,
    BasketGenerationProcessor,
    ProductsRepository,
  ],
})
export class FamilyBasketsModule {}
