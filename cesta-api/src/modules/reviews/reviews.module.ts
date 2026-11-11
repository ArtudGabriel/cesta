import { Module } from '@nestjs/common';
import { ProductsRepository } from '../products/products.repository';
import { ReviewsController } from './reviews.controller';
import { ReviewsRepository } from './reviews.repository';
import { ReviewsService } from './reviews.service';

@Module({
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewsRepository, ProductsRepository],
})
export class ReviewsModule {}
