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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AlertsService } from './alerts.service';
import { CreateAlertDto, UpdateAlertDto } from './dtos/create-alert.dto';

@ApiTags('Alerts')
@ApiBearerAuth()
@Controller('alerts')
export class AlertsController {
  constructor(private readonly service: AlertsService) {}

  @Get()
  @ApiOperation({ summary: 'Meus alertas' })
  list(@CurrentUser('id') userId: string) {
    return this.service.list(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Criar alerta' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateAlertDto) {
    return this.service.create(userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do alerta' })
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar alerta (toggle active, targetPrice)' })
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAlertDto,
  ) {
    return this.service.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir alerta' })
  async remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    await this.service.remove(userId, id);
  }
}
