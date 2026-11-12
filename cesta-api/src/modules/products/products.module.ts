import { Module } from '@nestjs/common';
import { PriceHistoryRepository } from './price-history.repository';
import { PriceHistoryService } from './price-history.service';
import { ProductsController } from './products.controller';
import { ProductsRepository } from './products.repository';
import { ProductsService } from './products.service';

@Module({
  controllers: [ProductsController],
  providers: [
    ProductsService,
    ProductsRepository,
    PriceHistoryService,
    PriceHistoryRepository,
  ],
  exports: [ProductsService],
})
export class ProductsModule {}
