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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AlertsService } from './alerts.service';
import { AlertRuleResponseDto } from './dtos/alert-rule.dto';
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

  // ──────────────────────────────────────────────────────────────
  // Sprint 105 — alert rules (combo/trend/bundle). Rotas específicas
  // antes de :id pra evitar colisão de matching.
  // ──────────────────────────────────────────────────────────────

  @Get('rules')
  @ApiOperation({ summary: 'Sprint 105 — listar regras combo/trend/bundle' })
  listRules(
    @CurrentUser('id') userId: string,
    @Query('type') type?: string,
  ): Promise<AlertRuleResponseDto[]> {
    return this.service.listRules(userId, type);
  }

  @Post('combo')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ write: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Sprint 105 — criar regra combo' })
  createCombo(
    @CurrentUser('id') userId: string,
    @Body() body: unknown,
  ): Promise<AlertRuleResponseDto> {
    return this.service.createRule(userId, 'combo', body);
  }

  @Post('trend')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ write: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Sprint 105 — criar regra trend' })
  createTrend(
    @CurrentUser('id') userId: string,
    @Body() body: unknown,
  ): Promise<AlertRuleResponseDto> {
    return this.service.createRule(userId, 'trend', body);
  }

  @Post('bundle')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ write: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Sprint 105 — criar regra bundle' })
  createBundle(
    @CurrentUser('id') userId: string,
    @Body() body: unknown,
  ): Promise<AlertRuleResponseDto> {
    return this.service.createRule(userId, 'bundle', body);
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
