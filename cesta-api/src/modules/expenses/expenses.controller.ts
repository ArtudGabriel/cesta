import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  ExpenseBucketDto,
  ExpenseSummaryDto,
  ExpenseTopProductDto,
} from './dtos/expense-response.dto';
import { ExpensesService, Period } from './expenses.service';

const VALID_PERIODS: Period[] = ['day', 'week', 'month'];

function parsePeriod(raw: string | undefined): Period {
  if (!raw) return 'month';
  if (!VALID_PERIODS.includes(raw as Period))
    throw new BadRequestException('period inválido');
  return raw as Period;
}

/**
 * Sprint 206 — @ApiResponse coverage expand expenses (ADR 0021 7→10).
 * Agregados sobre notas fiscais do usuário (summary/by-category/by-supermarket/top-products).
 */
@ApiTags('Expenses')
@ApiBearerAuth()
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly service: ExpensesService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Resumo de gasto no período' })
  @ApiQuery({ name: 'period', required: false, enum: VALID_PERIODS, description: 'Default: month' })
  @ApiOkResponse({ type: ExpenseSummaryDto })
  @ApiBadRequestResponse({ description: 'period fora de day/week/month' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  summary(
    @CurrentUser('id') userId: string,
    @Query('period') period?: string,
  ) {
    return this.service.summary(userId, parsePeriod(period));
  }

  @Get('by-category')
  @ApiOperation({ summary: 'Gasto por categoria' })
  @ApiQuery({ name: 'period', required: false, enum: VALID_PERIODS, description: 'Default: month' })
  @ApiOkResponse({ type: [ExpenseBucketDto] })
  @ApiBadRequestResponse({ description: 'period fora de day/week/month' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  byCategory(
    @CurrentUser('id') userId: string,
    @Query('period') period?: string,
  ) {
    return this.service.byCategory(userId, parsePeriod(period));
  }

  @Get('by-supermarket')
  @ApiOperation({ summary: 'Gasto por supermercado' })
  @ApiQuery({ name: 'period', required: false, enum: VALID_PERIODS, description: 'Default: month' })
  @ApiOkResponse({ type: [ExpenseBucketDto] })
  @ApiBadRequestResponse({ description: 'period fora de day/week/month' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  bySupermarket(
    @CurrentUser('id') userId: string,
    @Query('period') period?: string,
  ) {
    return this.service.bySupermarket(userId, parsePeriod(period));
  }

  @Get('top-products')
  @ApiOperation({ summary: 'Sprint 162 — top produtos caros no período' })
  @ApiQuery({ name: 'period', required: false, enum: VALID_PERIODS, description: 'Default: month' })
  @ApiOkResponse({ type: [ExpenseTopProductDto] })
  @ApiBadRequestResponse({ description: 'period fora de day/week/month' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  topProducts(
    @CurrentUser('id') userId: string,
    @Query('period') period?: string,
  ) {
    return this.service.topProducts(userId, parsePeriod(period));
  }
}
