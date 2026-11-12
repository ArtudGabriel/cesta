import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AddFavoriteDto } from './dtos/add-favorite.dto';
import { FavoritesService } from './favorites.service';

@ApiBearerAuth()
@ApiTags('Favorites')
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Post()
  @Throttle({ write: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Favorita produto (idempotente). 201 quando criado, 200 quando já existia.',
  })
  async add(
    @CurrentUser('id') userId: string,
    @Body() dto: AddFavoriteDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { favorite, created } = await this.favorites.add(
      userId,
      dto.productId,
    );
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return favorite;
  }

  @Delete(':productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desfavorita produto (idempotente)' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('productId') productId: string,
  ) {
    await this.favorites.remove(userId, productId);
  }

  @Get()
  @ApiOperation({ summary: 'Favoritos do usuário com cheapest price' })
  async list(@CurrentUser('id') userId: string) {
    return this.favorites.list(userId);
  }

  @Get('check')
  @ApiQuery({ name: 'productIds', description: 'IDs separados por vírgula' })
  @ApiOperation({ summary: 'Batch check quais productIds já estão favoritados' })
  async check(
    @CurrentUser('id') userId: string,
    @Query('productIds') productIds: string,
  ) {
    if (!productIds) throw new BadRequestException('productIds vazio');
    const ids = productIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const favorited = await this.favorites.check(userId, ids);
    return { favorited };
  }
}
