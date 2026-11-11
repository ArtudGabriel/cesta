import { ApiProperty } from '@nestjs/swagger';
import {
  Product,
  Receipt,
  ReceiptItem,
  Supermarket,
} from '@prisma/client';

export class ReceiptItemDto {
  @ApiProperty() id: string;
  @ApiProperty() rawText: string;
  @ApiProperty() normalizedName: string;
  @ApiProperty() quantity: number;
  @ApiProperty() unitPrice: number;
  @ApiProperty() total: number;
  @ApiProperty({ nullable: true }) productId: string | null;
  @ApiProperty({ nullable: true }) productName: string | null;
  @ApiProperty() position: number;

  static fromEntity(
    item: ReceiptItem & { product: Product | null },
  ): ReceiptItemDto {
    const dto = new ReceiptItemDto();
    dto.id = item.id;
    dto.rawText = item.rawText;
    dto.normalizedName = item.normalizedName;
    dto.quantity = Number(item.quantity);
    dto.unitPrice = Number(item.unitPrice);
    dto.total = Number(item.total);
    dto.productId = item.productId;
    dto.productName = item.product?.name ?? null;
    dto.position = item.position;
    return dto;
  }
}

export class ReceiptResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() status: string;
  @ApiProperty({ nullable: true }) errorMessage: string | null;
  @ApiProperty({ nullable: true }) supermarketSlug: string | null;
  @ApiProperty({ nullable: true }) supermarketName: string | null;
  @ApiProperty({ nullable: true }) purchaseDate: Date | null;
  @ApiProperty({ nullable: true }) total: number | null;
  @ApiProperty({ nullable: true }) imageUrl: string | null;
  @ApiProperty({ nullable: true }) notes: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ type: [ReceiptItemDto] })
  items: ReceiptItemDto[];

  static fromEntity(
    receipt: Receipt & {
      supermarket: Supermarket | null;
      items: (ReceiptItem & { product: Product | null })[];
    },
  ): ReceiptResponseDto {
    const dto = new ReceiptResponseDto();
    dto.id = receipt.id;
    dto.status = receipt.status;
    dto.errorMessage = receipt.errorMessage;
    dto.supermarketSlug = receipt.supermarket?.slug ?? receipt.supermarketSlug;
    dto.supermarketName = receipt.supermarket?.name ?? null;
    dto.purchaseDate = receipt.purchaseDate;
    dto.total = receipt.total ? Number(receipt.total) : null;
    dto.imageUrl = receipt.imageUrl;
    dto.notes = receipt.notes;
    dto.createdAt = receipt.createdAt;
    dto.items = receipt.items.map(ReceiptItemDto.fromEntity);
    return dto;
  }
}
