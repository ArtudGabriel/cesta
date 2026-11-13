import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppException } from '../../common/exceptions/app-exception';
import { ProductsRepository } from '../products/products.repository';
import { AlertsRepository } from './alerts.repository';
import { AlertResponseDto } from './dtos/alert-response.dto';
import { CreateAlertDto, UpdateAlertDto } from './dtos/create-alert.dto';

@Injectable()
export class AlertsService {
  constructor(
    private readonly repo: AlertsRepository,
    private readonly productsRepo: ProductsRepository,
  ) {}

  async list(userId: string): Promise<AlertResponseDto[]> {
    const items = await this.repo.findAllByUser(userId);
    return items.map(AlertResponseDto.fromEntity);
  }

  async findOne(userId: string, id: string): Promise<AlertResponseDto> {
    const alert = await this.repo.findByIdForUser(id, userId);
    if (!alert)
      throw new AppException(
        'ALERTS.NOT_FOUND',
        `Alerta "${id}" não encontrado`,
        HttpStatus.NOT_FOUND,
      );
    return AlertResponseDto.fromEntity(alert);
  }

  async create(userId: string, dto: CreateAlertDto): Promise<AlertResponseDto> {
    if (dto.type === 'target_price' && !dto.targetPrice) {
      throw new BadRequestException(
        'targetPrice é obrigatório para type=target_price',
      );
    }

    const product = await this.productsRepo.findById(dto.productId);
    if (!product)
      throw new AppException(
        'ALERTS.PRODUCT_NOT_FOUND',
        'Produto não encontrado',
        HttpStatus.NOT_FOUND,
      );

    const alert = await this.repo.create({
      userId,
      productId: dto.productId,
      supermarketId: dto.supermarketId ?? null,
      type: dto.type,
      targetPrice:
        dto.targetPrice != null ? new Prisma.Decimal(dto.targetPrice) : null,
    });

    return AlertResponseDto.fromEntity(alert);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateAlertDto,
  ): Promise<AlertResponseDto> {
    await this.assertOwner(userId, id);
    const updated = await this.repo.update(id, {
      isActive: dto.isActive,
      targetPrice:
        dto.targetPrice != null ? new Prisma.Decimal(dto.targetPrice) : undefined,
    });
    return AlertResponseDto.fromEntity(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.assertOwner(userId, id);
    await this.repo.softDelete(id);
  }

  private async assertOwner(userId: string, id: string): Promise<void> {
    const alert = await this.repo.findByIdForUser(id, userId);
    if (!alert) throw new ForbiddenException('Alerta não acessível');
  }
}
