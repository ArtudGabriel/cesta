import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateListDto, UpdateListDto } from './dtos/create-list.dto';
import { AddItemDto, UpdateItemDto } from './dtos/list-item.dto';
import {
  ListTotalsDto,
  ShoppingListResponseDto,
} from './dtos/list-response.dto';
import { ShoppingListsService } from './shopping-lists.service';

/**
 * Sprint 205 — @ApiResponse coverage expand shopping-lists.
 */
@ApiTags('Shopping Lists')
@ApiBearerAuth()
@Controller('shopping-lists')
export class ShoppingListsController {
  constructor(private readonly service: ShoppingListsService) {}

  @Get()
  @ApiOperation({ summary: 'Minhas listas de compras' })
  @ApiOkResponse({ type: [ShoppingListResponseDto] })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  findAll(@CurrentUser('id') userId: string) {
    return this.service.findAll(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Criar nova lista' })
  @ApiCreatedResponse({ type: ShoppingListResponseDto })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateListDto) {
    return this.service.create(userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe de uma lista com items' })
  @ApiOkResponse({ type: ShoppingListResponseDto })
  @ApiNotFoundResponse({ description: 'Lista não encontrada' })
  @ApiForbiddenResponse({ description: 'Lista pertence a outro usuário' })
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Renomear lista' })
  @ApiOkResponse({ type: ShoppingListResponseDto })
  @ApiNotFoundResponse({ description: 'Lista não encontrada' })
  @ApiForbiddenResponse({ description: 'Lista pertence a outro usuário' })
  rename(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateListDto,
  ) {
    return this.service.rename(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir lista (soft delete)' })
  @ApiNoContentResponse({ description: 'Lista removida' })
  @ApiNotFoundResponse({ description: 'Lista não encontrada' })
  @ApiForbiddenResponse({ description: 'Lista pertence a outro usuário' })
  async remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    await this.service.remove(userId, id);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicar lista' })
  @ApiCreatedResponse({ type: ShoppingListResponseDto })
  @ApiNotFoundResponse({ description: 'Lista fonte não encontrada' })
  duplicate(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.duplicate(userId, id);
  }

  @Post(':id/items')
  @ApiOperation({ summary: 'Adicionar produto à lista' })
  @ApiCreatedResponse({ type: ShoppingListResponseDto })
  @ApiNotFoundResponse({ description: 'Lista ou produto não encontrado' })
  addItem(
    @CurrentUser('id') userId: string,
    @Param('id') listId: string,
    @Body() dto: AddItemDto,
  ) {
    return this.service.addItem(userId, listId, dto);
  }

  @Patch(':id/items/:itemId')
  @ApiOperation({ summary: 'Alterar quantidade de um item' })
  @ApiOkResponse({ type: ShoppingListResponseDto })
  @ApiNotFoundResponse({ description: 'Lista ou item não encontrado' })
  updateItem(
    @CurrentUser('id') userId: string,
    @Param('id') listId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.service.updateItem(userId, listId, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @ApiOperation({ summary: 'Remover item da lista' })
  @ApiOkResponse({ type: ShoppingListResponseDto })
  @ApiNotFoundResponse({ description: 'Lista ou item não encontrado' })
  removeItem(
    @CurrentUser('id') userId: string,
    @Param('id') listId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.service.removeItem(userId, listId, itemId);
  }

  @Get(':id/totals')
  @ApiOperation({
    summary: 'Totais em tempo real por supermercado + lista híbrida',
  })
  @ApiOkResponse({ type: ListTotalsDto })
  @ApiNotFoundResponse({ description: 'Lista não encontrada' })
  totals(@CurrentUser('id') userId: string, @Param('id') listId: string) {
    return this.service.totals(userId, listId);
  }
}
