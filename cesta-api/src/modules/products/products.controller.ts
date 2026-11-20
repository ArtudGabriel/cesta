import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { CUID_PATTERN } from '../../common/validators/is-cuid.validator';
import { PriceHistoryQueryDto } from './dtos/price-history-query.dto';
import { ProductFiltersDto } from './dtos/product-filters.dto';
import { productSearchQuerySchema } from './dtos/product-search.dto';
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
  // Named throttlers (default/strict/write) aplicam todos simultaneamente;
  // @Throttle override apenas a key passada. Precisamos sobrescrever os 3
  // pra evitar que `strict: 5/60s` global corte autocomplete (bug cascata
  // documentado em S98 — memory feedback-throttler-named-global).
  @Throttle({
    default: { limit: 20, ttl: 60_000 },
    strict: { limit: 20, ttl: 60_000 },
    write: { limit: 20, ttl: 60_000 },
  })
  @Get('search')
  @ApiOperation({
    summary:
      'Autocomplete minimalista (ProductPicker): ILIKE name/brand, até 10 items, ordenado por preço asc',
  })
  search(@Query() raw: Record<string, unknown>) {
    const parsed = productSearchQuerySchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException({
        message: parsed.error.issues.map((i) => i.message).join('; '),
      });
    }
    return this.productsService.search(parsed.data);
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
  @Get('featured-deals')
  @ApiOperation({
    summary:
      'Top N produtos com maior gap de preço entre supermarkets (sprint 132). Ordenado por spread DESC.',
  })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  featuredDeals(@Query('limit') limitRaw?: string) {
    const parsed = limitRaw != null ? Number.parseInt(limitRaw, 10) : 10;
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 50) {
      throw new BadRequestException('limit deve estar entre 1 e 50');
    }
    return this.productsService.featuredDeals(parsed);
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
