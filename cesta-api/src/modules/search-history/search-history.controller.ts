import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AddSearchHistoryDto } from './dtos/add-search-history.dto';
import { SearchHistoryService } from './search-history.service';

@ApiBearerAuth()
@ApiTags('SearchHistory')
@Controller('search-history')
export class SearchHistoryController {
  constructor(private readonly service: SearchHistoryService) {}

  @Get()
  @ApiOperation({ summary: 'Lista histórico recente (cap 10)' })
  async list(@CurrentUser('id') userId: string) {
    const history = await this.service.list(userId);
    return { history };
  }

  @Post()
  @Throttle({ write: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Adiciona query. 201 quando nova, 200 quando já existia (MRU touch).',
  })
  async add(
    @CurrentUser('id') userId: string,
    @Body() dto: AddSearchHistoryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { item, created } = await this.service.add(userId, dto.query);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return item;
  }

  @Delete(':query')
  @Throttle({ write: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove uma query (idempotente)' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('query') query: string,
  ) {
    await this.service.removeByQuery(userId, decodeURIComponent(query));
  }

  @Delete()
  @Throttle({ write: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Limpa histórico inteiro' })
  async clear(@CurrentUser('id') userId: string) {
    await this.service.clearAll(userId);
  }
}
