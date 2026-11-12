import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CUID_PATTERN } from '../../common/validators/is-cuid.validator';
import { PriceHistoryQueryDto } from './dtos/price-history-query.dto';
import { ProductFiltersDto } from './dtos/product-filters.dto';
import { SuggestQueryDto } from './dtos/suggest-query.dto';
import { PriceHistoryService } from './price-history.service';
import { ProductsService } from './products.service';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly priceHistoryService: PriceHistoryService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Listar produtos com filtros e preço por mercado',
  })
  findMany(@Query() filters: ProductFiltersDto) {
    return this.productsService.findMany(filters);
  }

  @Public()
  @Get('suggest')
  @ApiOperation({ summary: 'Autocomplete de busca por nome/marca (min 2 chars, max 20 resultados)' })
  suggest(@Query() query: SuggestQueryDto) {
    return this.productsService.suggest(query.q, query.limit);
  }

  @Public()
  @Get('compare')
  @ApiOperation({ summary: 'Comparar múltiplos produtos (até 20)' })
  @ApiQuery({ name: 'ids', description: 'IDs separados por vírgula' })
  compare(@Query('ids') ids: string) {
    if (!ids) throw new BadRequestException('Parâmetro "ids" é obrigatório');
    if (ids.length > 600) {
      throw new BadRequestException('Parâmetro "ids" excede tamanho máximo');
    }
    const parsed = ids
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    for (const id of parsed) {
      if (!CUID_PATTERN.test(id)) {
        throw new BadRequestException(`id "${id}" não é um CUID válido`);
      }
    }
    return this.productsService.compare(parsed);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do produto com preços em todos os mercados' })
  findOne(@Param('id') id: string) {
    if (!CUID_PATTERN.test(id)) {
      throw new BadRequestException('id não é um CUID válido');
    }
    return this.productsService.findById(id);
  }

  @Public()
  @Get(':id/price-history')
  @ApiOperation({
    summary:
      'Histórico de preços por mercado (últimos N dias, max 90). Agrupa por mercado se supermarketId omitido.',
  })
  priceHistory(@Param('id') id: string, @Query() query: PriceHistoryQueryDto) {
    if (!CUID_PATTERN.test(id)) {
      throw new BadRequestException('id não é um CUID válido');
    }
    return this.priceHistoryService.getSeries(id, {
      supermarketId: query.supermarketId,
      days: query.days,
    });
  }
}
