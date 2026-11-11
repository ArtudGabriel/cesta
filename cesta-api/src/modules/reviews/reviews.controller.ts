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
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CreateReviewDto, UpdateReviewDto } from './dtos/create-review.dto';
import { ReviewsQueryDto } from './dtos/reviews-query.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Public()
  @Get('products/:pid/reviews')
  @ApiOperation({ summary: 'Listar avaliações de um produto' })
  findByProduct(
    @Param('pid') productId: string,
    @Query() query: ReviewsQueryDto,
    @Req() req: Request & { user?: AuthenticatedUser },
  ) {
    return this.reviewsService.findByProduct(productId, query, req.user?.id);
  }

  @Public()
  @Get('products/:pid/reviews/summary')
  @ApiOperation({ summary: 'Média + distribuição de avaliações' })
  summary(@Param('pid') productId: string) {
    return this.reviewsService.summary(productId);
  }

  @Get('products/:pid/reviews/mine')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Avaliação do usuário logado para este produto' })
  findMine(
    @CurrentUser('id') userId: string,
    @Param('pid') productId: string,
  ) {
    return this.reviewsService.findMine(userId, productId);
  }

  @Post('reviews')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar avaliação (1 por usuário/produto)' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(userId, dto);
  }

  @Patch('reviews/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Editar avaliação própria' })
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewsService.update(userId, id, dto);
  }

  @Delete('reviews/:id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir avaliação própria' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.reviewsService.remove(userId, id);
  }

  @Post('reviews/:id/helpful')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle útil' })
  toggleHelpful(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.reviewsService.toggleHelpful(userId, id);
  }

  @Post('reviews/:id/report')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reportar avaliação inadequada' })
  async report(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.reviewsService.report(userId, id);
  }
}
