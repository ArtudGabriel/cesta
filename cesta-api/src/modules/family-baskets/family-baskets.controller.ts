import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  AddBasketItemDto,
  UpdateBasketItemDto,
} from './dtos/basket-item.dto';
import { FamilyBasketsService } from './family-baskets.service';

@ApiTags('Family Baskets')
@ApiBearerAuth()
@Controller('family-baskets')
export class FamilyBasketsController {
  constructor(private readonly service: FamilyBasketsService) {}

  @Post('generate')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ familyBasket: { limit: 1, ttl: 86_400_000 } })
  @ApiOperation({ summary: 'Gera cesta familiar a partir do perfil (async) — 1/24h' })
  generate(@CurrentUser('id') userId: string) {
    return this.service.generate(userId);
  }

  @Post(':id/regenerate')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ familyBasket: { limit: 1, ttl: 86_400_000 } })
  @ApiOperation({
    summary:
      'Regenera cesta preservando items locked + required (async) — 1/24h',
  })
  regenerate(
    @CurrentUser('id') userId: string,
    @Param('id') basketId: string,
  ) {
    return this.service.regenerate(userId, basketId);
  }

  @Get('latest')
  @ApiOperation({ summary: 'Cesta mais recente do usuário' })
  findLatest(@CurrentUser('id') userId: string) {
    return this.service.findLatest(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe da cesta' })
  findOne(
    @CurrentUser('id') userId: string,
    @Param('id') basketId: string,
  ) {
    return this.service.findOne(userId, basketId);
  }

  @Post(':id/items')
  @ApiOperation({ summary: 'Adicionar/atualizar item na cesta' })
  addItem(
    @CurrentUser('id') userId: string,
    @Param('id') basketId: string,
    @Body() dto: AddBasketItemDto,
  ) {
    return this.service.addItem(userId, basketId, dto);
  }

  @Patch(':id/items/:itemId')
  @ApiOperation({ summary: 'Editar item (qty/locked/required)' })
  updateItem(
    @CurrentUser('id') userId: string,
    @Param('id') basketId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateBasketItemDto,
  ) {
    return this.service.updateItem(userId, basketId, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @ApiOperation({ summary: 'Remover item' })
  removeItem(
    @CurrentUser('id') userId: string,
    @Param('id') basketId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.service.removeItem(userId, basketId, itemId);
  }
}
