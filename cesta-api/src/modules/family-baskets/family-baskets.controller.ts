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
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  AddBasketItemDto,
  UpdateBasketItemDto,
} from './dtos/basket-item.dto';
import { FamilyBasketResponseDto } from './dtos/basket-response.dto';
import { FamilyBasketsService } from './family-baskets.service';

/**
 * Sprint 207 — @ApiResponse coverage expand family-baskets (ADR 0021 10→13).
 * Generate/regenerate retornam 202 (job BullMQ async) com basket em status=pending.
 * Operações item retornam o basket inteiro (refetch) — simplifica refresh frontend.
 */
@ApiTags('Family Baskets')
@ApiBearerAuth()
@Controller('family-baskets')
export class FamilyBasketsController {
  constructor(private readonly service: FamilyBasketsService) {}

  @Post('generate')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 1, ttl: 86_400_000 } })
  @ApiOperation({ summary: 'Gera cesta familiar a partir do perfil (async) — 1/24h' })
  @ApiAcceptedResponse({
    type: FamilyBasketResponseDto,
    description:
      'Basket criada em status=pending; worker processa em background. Poll GET /family-baskets/latest.',
  })
  @ApiNotFoundResponse({ description: 'Perfil familiar inexistente — criar via PUT /family-profiles/me primeiro' })
  @ApiTooManyRequestsResponse({ description: 'Limite 1 geração / 24h excedido' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  generate(@CurrentUser('id') userId: string) {
    return this.service.generate(userId);
  }

  @Post(':id/regenerate')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 1, ttl: 86_400_000 } })
  @ApiOperation({
    summary:
      'Regenera cesta preservando items locked + required (async) — 1/24h',
  })
  @ApiAcceptedResponse({
    type: FamilyBasketResponseDto,
    description: 'Cesta transita pra status=pending; items locked/required preservados.',
  })
  @ApiNotFoundResponse({ description: 'Cesta não encontrada ou pertence a outro usuário' })
  @ApiConflictResponse({ description: 'Cesta já em geração (status=pending)' })
  @ApiTooManyRequestsResponse({ description: 'Limite 1 regeneração / 24h excedido' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  regenerate(
    @CurrentUser('id') userId: string,
    @Param('id') basketId: string,
  ) {
    return this.service.regenerate(userId, basketId);
  }

  @Get('latest')
  @ApiOperation({ summary: 'Cesta mais recente do usuário' })
  @ApiOkResponse({ type: FamilyBasketResponseDto, description: 'Cesta mais recente ou null se nunca gerada' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  findLatest(@CurrentUser('id') userId: string) {
    return this.service.findLatest(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe da cesta' })
  @ApiOkResponse({ type: FamilyBasketResponseDto })
  @ApiNotFoundResponse({ description: 'Cesta não encontrada ou pertence a outro usuário' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  findOne(
    @CurrentUser('id') userId: string,
    @Param('id') basketId: string,
  ) {
    return this.service.findOne(userId, basketId);
  }

  @Post(':id/items')
  @ApiOperation({ summary: 'Adicionar/atualizar item na cesta' })
  @ApiCreatedResponse({ type: FamilyBasketResponseDto, description: 'Cesta atualizada (refetch com items)' })
  @ApiBadRequestResponse({ description: 'DTO inválido (productId/quantity)' })
  @ApiNotFoundResponse({ description: 'Cesta ou produto não encontrado' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  addItem(
    @CurrentUser('id') userId: string,
    @Param('id') basketId: string,
    @Body() dto: AddBasketItemDto,
  ) {
    return this.service.addItem(userId, basketId, dto);
  }

  @Patch(':id/items/:itemId')
  @ApiOperation({ summary: 'Editar item (qty/locked/required)' })
  @ApiOkResponse({ type: FamilyBasketResponseDto, description: 'Cesta atualizada (refetch com items)' })
  @ApiBadRequestResponse({ description: 'DTO inválido' })
  @ApiNotFoundResponse({ description: 'Cesta ou item não encontrado' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
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
  @ApiOkResponse({ type: FamilyBasketResponseDto, description: 'Cesta atualizada (item removido)' })
  @ApiNotFoundResponse({ description: 'Cesta ou item não encontrado' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  removeItem(
    @CurrentUser('id') userId: string,
    @Param('id') basketId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.service.removeItem(userId, basketId, itemId);
  }
}
