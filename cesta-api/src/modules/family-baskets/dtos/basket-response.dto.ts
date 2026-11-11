import { ApiProperty } from '@nestjs/swagger';
import {
  FamilyBasket,
  FamilyBasketItem,
  Product,
  ProductPrice,
  Supermarket,
} from '@prisma/client';
import {
  ProductResponseDto,
} from '../../products/dtos/product-response.dto';

export class BasketItemDto {
  @ApiProperty() id: string;
  @ApiProperty() productId: string;
  @ApiProperty() quantity: number;
  @ApiProperty() unitPrice: number;
  @ApiProperty() subtotal: number;
  @ApiProperty() isRequired: boolean;
  @ApiProperty() isLocked: boolean;
  @ApiProperty() position: number;
  @ApiProperty() product: ProductResponseDto;
}

export class FamilyBasketResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() status: string;
  @ApiProperty({ nullable: true }) errorMessage: string | null;
  @ApiProperty() estimatedCost: number;
  @ApiProperty() generatedAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiProperty({ type: [BasketItemDto] })
  items: BasketItemDto[];

  static fromEntity(
    basket: FamilyBasket & {
      items: (FamilyBasketItem & {
        product: Product & {
          prices: (ProductPrice & { supermarket: Supermarket })[];
        };
      })[];
    },
  ): FamilyBasketResponseDto {
    const dto = new FamilyBasketResponseDto();
    dto.id = basket.id;
    dto.status = basket.status;
    dto.errorMessage = basket.errorMessage;
    dto.estimatedCost = Number(basket.estimatedCost);
    dto.generatedAt = basket.generatedAt;
    dto.updatedAt = basket.updatedAt;
    dto.items = basket.items.map((item) => {
      const unitPrice = Number(item.unitPrice);
      const quantity = Number(item.quantity);
      return {
        id: item.id,
        productId: item.productId,
        quantity,
        unitPrice,
        subtotal: Math.round(unitPrice * quantity * 100) / 100,
        isRequired: item.isRequired,
        isLocked: item.isLocked,
        position: item.position,
        product: ProductResponseDto.fromEntity(item.product),
      };
    });
    return dto;
  }
}
