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
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AlertsService } from './alerts.service';
import { AlertResponseDto } from './dtos/alert-response.dto';
import { AlertRuleResponseDto, ALERT_RULE_TYPES } from './dtos/alert-rule.dto';
import { CreateAlertDto, UpdateAlertDto } from './dtos/create-alert.dto';

/**
 * Sprint 206 — @ApiResponse coverage expand alerts (ADR 0021 7→10).
 */
@ApiTags('Alerts')
@ApiBearerAuth()
@Controller('alerts')
export class AlertsController {
  constructor(private readonly service: AlertsService) {}

  @Get()
  @ApiOperation({ summary: 'Meus alertas' })
  @ApiOkResponse({ type: [AlertResponseDto] })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  list(@CurrentUser('id') userId: string) {
    return this.service.list(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Criar alerta' })
  @ApiCreatedResponse({ type: AlertResponseDto })
  @ApiBadRequestResponse({ description: 'DTO inválido (targetPrice ausente p/ target_price)' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateAlertDto) {
    return this.service.create(userId, dto);
  }

  // ──────────────────────────────────────────────────────────────
  // Sprint 105 — alert rules (combo/trend/bundle). Rotas específicas
  // antes de :id pra evitar colisão de matching.
  // ──────────────────────────────────────────────────────────────

  @Get('rules')
  @ApiOperation({ summary: 'Sprint 105 — listar regras combo/trend/bundle' })
  @ApiQuery({ name: 'type', required: false, enum: ALERT_RULE_TYPES })
  @ApiOkResponse({ type: [AlertRuleResponseDto] })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
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
  @ApiCreatedResponse({ type: AlertRuleResponseDto })
  @ApiBadRequestResponse({ description: 'Payload comboRulesSchema inválido' })
  @ApiConflictResponse({ description: 'Regra duplicada (canonicalKey match)' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
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
  @ApiCreatedResponse({ type: AlertRuleResponseDto })
  @ApiBadRequestResponse({ description: 'Payload trendRulesSchema inválido' })
  @ApiConflictResponse({ description: 'Regra duplicada (canonicalKey match)' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
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
  @ApiCreatedResponse({ type: AlertRuleResponseDto })
  @ApiBadRequestResponse({ description: 'Payload bundleRulesSchema inválido' })
  @ApiConflictResponse({ description: 'Regra duplicada (canonicalKey match)' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  createBundle(
    @CurrentUser('id') userId: string,
    @Body() body: unknown,
  ): Promise<AlertRuleResponseDto> {
    return this.service.createRule(userId, 'bundle', body);
  }

  // Sprint 160 — rule inline actions (toggle + soft delete).
  // Rotas específicas antes de `:id` pra evitar colisão com @Get(':id').

  @Patch('rules/:id')
  @Throttle({ write: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Sprint 160 — toggle isActive de regra' })
  @ApiOkResponse({ type: AlertRuleResponseDto })
  @ApiNotFoundResponse({ description: 'Regra não encontrada ou pertence a outro usuário' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  toggleRule(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ): Promise<AlertRuleResponseDto> {
    return this.service.toggleRule(userId, id, Boolean(body?.isActive));
  }

  @Delete('rules/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ write: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Sprint 160 — soft delete regra' })
  @ApiNoContentResponse({ description: 'Regra removida' })
  @ApiNotFoundResponse({ description: 'Regra não encontrada ou pertence a outro usuário' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  async removeRule(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.removeRule(userId, id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do alerta' })
  @ApiOkResponse({ type: AlertResponseDto })
  @ApiNotFoundResponse({ description: 'Alerta não encontrado ou pertence a outro usuário' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar alerta (toggle active, targetPrice)' })
  @ApiOkResponse({ type: AlertResponseDto })
  @ApiNotFoundResponse({ description: 'Alerta não encontrado ou pertence a outro usuário' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
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
  @ApiNoContentResponse({ description: 'Alerta removido' })
  @ApiNotFoundResponse({ description: 'Alerta não encontrado ou pertence a outro usuário' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  async remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    await this.service.remove(userId, id);
  }
}
