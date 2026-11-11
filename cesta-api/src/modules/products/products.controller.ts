import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ProductFiltersDto } from './dtos/product-filters.dto';
import { ProductsService } from './products.service';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Listar produtos com filtros e preço por mercado',
  })
  findMany(@Query() filters: ProductFiltersDto) {
    return this.productsService.findMany(filters);
  }

  @Public()
  @Get('compare')
  @ApiOperation({ summary: 'Comparar múltiplos produtos (até 20)' })
  @ApiQuery({ name: 'ids', description: 'IDs separados por vírgula' })
  compare(@Query('ids') ids: string) {
    if (!ids) throw new BadRequestException('Parâmetro "ids" é obrigatório');
    return this.productsService.compare(
      ids.split(',').map((id) => id.trim()).filter(Boolean),
    );
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do produto com preços em todos os mercados' })
  findOne(@Param('id') id: string) {
    return this.productsService.findById(id);
  }
}
