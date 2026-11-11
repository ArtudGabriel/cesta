import { ApiProperty } from '@nestjs/swagger';
import {
  Alert,
  AlertTrigger,
  Product,
  Supermarket,
} from '@prisma/client';

export class AlertTriggerDto {
  @ApiProperty() id: string;
  @ApiProperty() reason: string;
  @ApiProperty() priceSnapshot: number;
  @ApiProperty({ nullable: true }) notifiedAt: Date | null;
  @ApiProperty() createdAt: Date;

  static fromEntity(trigger: AlertTrigger): AlertTriggerDto {
    const dto = new AlertTriggerDto();
    dto.id = trigger.id;
    dto.reason = trigger.reason;
    dto.priceSnapshot = Number(trigger.priceSnapshot);
    dto.notifiedAt = trigger.notifiedAt;
    dto.createdAt = trigger.createdAt;
    return dto;
  }
}

export class AlertResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() productId: string;
  @ApiProperty() productName: string;
  @ApiProperty({ nullable: true }) productImageUrl: string | null;
  @ApiProperty({ nullable: true }) supermarketId: string | null;
  @ApiProperty({ nullable: true }) supermarketName: string | null;
  @ApiProperty() type: string;
  @ApiProperty({ nullable: true }) targetPrice: number | null;
  @ApiProperty() isActive: boolean;
  @ApiProperty({ nullable: true }) lastTriggeredAt: Date | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ type: [AlertTriggerDto] })
  triggers: AlertTriggerDto[];

  static fromEntity(
    alert: Alert & {
      product: Product;
      supermarket: Supermarket | null;
      triggers?: AlertTrigger[];
    },
  ): AlertResponseDto {
    const dto = new AlertResponseDto();
    dto.id = alert.id;
    dto.productId = alert.productId;
    dto.productName = alert.product.name;
    dto.productImageUrl = alert.product.imageUrl;
    dto.supermarketId = alert.supermarketId;
    dto.supermarketName = alert.supermarket?.name ?? null;
    dto.type = alert.type;
    dto.targetPrice = alert.targetPrice ? Number(alert.targetPrice) : null;
    dto.isActive = alert.isActive;
    dto.lastTriggeredAt = alert.lastTriggeredAt;
    dto.createdAt = alert.createdAt;
    dto.triggers = (alert.triggers ?? []).map(AlertTriggerDto.fromEntity);
    return dto;
  }
}
