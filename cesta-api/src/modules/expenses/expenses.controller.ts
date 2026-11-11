import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ExpensesService, Period } from './expenses.service';

const VALID_PERIODS: Period[] = ['day', 'week', 'month'];

function parsePeriod(raw: string | undefined): Period {
  if (!raw) return 'month';
  if (!VALID_PERIODS.includes(raw as Period))
    throw new BadRequestException('period inválido');
  return raw as Period;
}

@ApiTags('Expenses')
@ApiBearerAuth()
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly service: ExpensesService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Resumo de gasto no período' })
  summary(
    @CurrentUser('id') userId: string,
    @Query('period') period?: string,
  ) {
    return this.service.summary(userId, parsePeriod(period));
  }

  @Get('by-category')
  @ApiOperation({ summary: 'Gasto por categoria' })
  byCategory(
    @CurrentUser('id') userId: string,
    @Query('period') period?: string,
  ) {
    return this.service.byCategory(userId, parsePeriod(period));
  }

  @Get('by-supermarket')
  @ApiOperation({ summary: 'Gasto por supermercado' })
  bySupermarket(
    @CurrentUser('id') userId: string,
    @Query('period') period?: string,
  ) {
    return this.service.bySupermarket(userId, parsePeriod(period));
  }
}
