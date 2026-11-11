import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SupermarketsService } from './supermarkets.service';

@ApiTags('Supermarkets')
@Controller('supermarkets')
export class SupermarketsController {
  constructor(private readonly supermarketsService: SupermarketsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Listar supermercados ativos' })
  findAll() {
    return this.supermarketsService.findAll();
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Buscar supermercado por slug' })
  findBySlug(@Param('slug') slug: string) {
    return this.supermarketsService.findBySlug(slug);
  }
}
