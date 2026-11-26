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
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AddFavoriteDto } from './dtos/add-favorite.dto';
import { FavoriteResponseDto } from './dtos/favorite-response.dto';
import { FavoritesService } from './favorites.service';

/**
 * Sprint 205 — @ApiResponse coverage expand favorites.
 */
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
  @ApiCreatedResponse({ type: FavoriteResponseDto, description: 'Favorito criado' })
  @ApiOkResponse({ type: FavoriteResponseDto, description: 'Favorito já existia (idempotente)' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
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
  @ApiNoContentResponse({ description: 'Favorito removido (ou nunca existiu)' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('productId') productId: string,
  ) {
    await this.favorites.remove(userId, productId);
  }

  @Get()
  @ApiOperation({ summary: 'Favoritos do usuário com cheapest price' })
  @ApiOkResponse({ type: [FavoriteResponseDto] })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  async list(@CurrentUser('id') userId: string) {
    return this.favorites.list(userId);
  }

  @Get('check')
  @ApiQuery({ name: 'productIds', description: 'IDs separados por vírgula' })
  @ApiOperation({ summary: 'Batch check quais productIds já estão favoritados' })
  @ApiOkResponse({
    description: 'Lista subset de productIds já favoritados',
    schema: {
      type: 'object',
      properties: {
        favorited: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'productIds query param vazio' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
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
