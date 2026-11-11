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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateListDto, UpdateListDto } from './dtos/create-list.dto';
import { AddItemDto, UpdateItemDto } from './dtos/list-item.dto';
import { ShoppingListsService } from './shopping-lists.service';

@ApiTags('Shopping Lists')
@ApiBearerAuth()
@Controller('shopping-lists')
export class ShoppingListsController {
  constructor(private readonly service: ShoppingListsService) {}

  @Get()
  @ApiOperation({ summary: 'Minhas listas de compras' })
  findAll(@CurrentUser('id') userId: string) {
    return this.service.findAll(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Criar nova lista' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateListDto) {
    return this.service.create(userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe de uma lista com items' })
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Renomear lista' })
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
  async remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    await this.service.remove(userId, id);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicar lista' })
  duplicate(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.duplicate(userId, id);
  }

  @Post(':id/items')
  @ApiOperation({ summary: 'Adicionar produto à lista' })
  addItem(
    @CurrentUser('id') userId: string,
    @Param('id') listId: string,
    @Body() dto: AddItemDto,
  ) {
    return this.service.addItem(userId, listId, dto);
  }

  @Patch(':id/items/:itemId')
  @ApiOperation({ summary: 'Alterar quantidade de um item' })
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
  totals(@CurrentUser('id') userId: string, @Param('id') listId: string) {
    return this.service.totals(userId, listId);
  }
}
