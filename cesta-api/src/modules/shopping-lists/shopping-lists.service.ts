import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductsRepository } from '../products/products.repository';
import { CreateListDto, UpdateListDto } from './dtos/create-list.dto';
import { AddItemDto, UpdateItemDto } from './dtos/list-item.dto';
import {
  calcTotalsBySupermarket,
  HybridItemDto,
  ListTotalsDto,
  ShoppingListResponseDto,
} from './dtos/list-response.dto';
import { ShoppingListsRepository } from './shopping-lists.repository';

@Injectable()
export class ShoppingListsService {
  constructor(
    private readonly repo: ShoppingListsRepository,
    private readonly productsRepo: ProductsRepository,
  ) {}

  async findAll(userId: string): Promise<ShoppingListResponseDto[]> {
    const lists = await this.repo.findAllByUser(userId);
    return lists.map((l) => ShoppingListResponseDto.fromEntity(l));
  }

  async findOne(userId: string, id: string): Promise<ShoppingListResponseDto> {
    const list = await this.repo.findByIdForUser(id, userId);
    if (!list) throw new NotFoundException(`Lista "${id}" não encontrada`);
    return ShoppingListResponseDto.fromEntity(list);
  }

  async create(
    userId: string,
    dto: CreateListDto,
  ): Promise<ShoppingListResponseDto> {
    const list = await this.repo.create(userId, dto.name);
    return ShoppingListResponseDto.fromEntity(list);
  }

  async rename(
    userId: string,
    id: string,
    dto: UpdateListDto,
  ): Promise<ShoppingListResponseDto> {
    await this.assertOwner(userId, id);
    await this.repo.updateName(id, dto.name);
    return this.findOne(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.assertOwner(userId, id);
    await this.repo.softDelete(id);
  }

  async duplicate(
    userId: string,
    id: string,
  ): Promise<ShoppingListResponseDto> {
    const source = await this.repo.findByIdForUser(id, userId);
    if (!source) throw new NotFoundException(`Lista "${id}" não encontrada`);
    const dup = await this.repo.duplicate(source);
    return ShoppingListResponseDto.fromEntity(dup);
  }

  async addItem(
    userId: string,
    listId: string,
    dto: AddItemDto,
  ): Promise<ShoppingListResponseDto> {
    await this.assertOwner(userId, listId);
    const product = await this.productsRepo.findById(dto.productId);
    if (!product)
      throw new NotFoundException(`Produto "${dto.productId}" não encontrado`);

    await this.repo.addItem(listId, dto.productId, dto.quantity ?? 1, dto.position);
    return this.findOne(userId, listId);
  }

  async updateItem(
    userId: string,
    listId: string,
    itemId: string,
    dto: UpdateItemDto,
  ): Promise<ShoppingListResponseDto> {
    await this.assertItemOwner(userId, itemId);
    await this.repo.updateItemQuantity(itemId, dto.quantity);
    return this.findOne(userId, listId);
  }

  async removeItem(
    userId: string,
    listId: string,
    itemId: string,
  ): Promise<ShoppingListResponseDto> {
    await this.assertItemOwner(userId, itemId);
    await this.repo.removeItem(itemId);
    return this.findOne(userId, listId);
  }

  async totals(userId: string, listId: string): Promise<ListTotalsDto> {
    const list = await this.repo.findByIdForUser(listId, userId);
    if (!list) throw new NotFoundException(`Lista "${listId}" não encontrada`);

    const dto = ShoppingListResponseDto.fromEntity(list);
    const items = dto.items ?? [];
    const bySupermarket = calcTotalsBySupermarket(items);

    const completeOnly = bySupermarket.filter((t) => t.missingItems === 0);
    const sorted = [...completeOnly].sort((a, b) => a.total - b.total);
    const cheapest = sorted[0] ?? null;
    const mostExpensive = sorted[sorted.length - 1] ?? null;
    const savings =
      cheapest && mostExpensive
        ? round2(mostExpensive.total - cheapest.total)
        : 0;

    // Lista híbrida: compra cada item no mercado onde está mais barato
    const hybridItems: HybridItemDto[] = [];
    for (const item of items) {
      const available = item.product.prices.filter((p) => p.isAvailable);
      if (available.length === 0) continue;
      const cheap = available.reduce((a, b) => (a.price < b.price ? a : b));
      hybridItems.push({
        productId: item.productId,
        productName: item.product.name,
        quantity: item.quantity,
        supermarketSlug: cheap.supermarketSlug,
        supermarketName: cheap.supermarketName,
        supermarketColor: cheap.supermarketColor,
        unitPrice: cheap.price,
        subtotal: round2(cheap.price * item.quantity),
        onPromotion: cheap.onPromotion,
      });
    }
    const hybridTotal = round2(
      hybridItems.reduce((sum, i) => sum + i.subtotal, 0),
    );
    const hybridSavings = cheapest
      ? round2(cheapest.total - hybridTotal)
      : 0;

    return {
      bySupermarket,
      cheapestSupermarketSlug: cheapest?.supermarketSlug ?? null,
      cheapestTotal: cheapest?.total ?? null,
      mostExpensiveTotal: mostExpensive?.total ?? null,
      savingsVsMostExpensive: savings,
      hybridItems,
      hybridTotal,
      hybridSavings,
      generatedAt: new Date(),
    };
  }

  private async assertOwner(userId: string, listId: string): Promise<void> {
    const list = await this.repo.findByIdForUser(listId, userId);
    if (!list) throw new ForbiddenException('Lista não acessível');
  }

  private async assertItemOwner(userId: string, itemId: string): Promise<void> {
    const item = await this.repo.findItemForUser(itemId, userId);
    if (!item) throw new ForbiddenException('Item não acessível');
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
