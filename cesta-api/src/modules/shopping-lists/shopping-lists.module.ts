import { Module } from '@nestjs/common';
import { ProductsRepository } from '../products/products.repository';
import { ShoppingListsController } from './shopping-lists.controller';
import { ShoppingListsRepository } from './shopping-lists.repository';
import { ShoppingListsService } from './shopping-lists.service';

@Module({
  controllers: [ShoppingListsController],
  providers: [ShoppingListsService, ShoppingListsRepository, ProductsRepository],
})
export class ShoppingListsModule {}
