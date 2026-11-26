import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminGuard } from '../../common/guards/admin.guard';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { AdminMetricsService } from './admin-metrics.service';
import {
  AdminMetricsResponseDto,
  AuditLogsListDto,
  CancelDeleteResponseDto,
  SoftDeletedUsersListDto,
} from './dtos/admin-response.dto';
import { ListAuditLogsQueryDto } from './dtos/list-audit-logs-query.dto';
import { ListUsersQueryDto } from './dtos/list-users-query.dto';

/**
 * Sprint 208 — @ApiResponse coverage expand admin (ADR 0021 13→17).
 */
@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly users: UsersService,
    private readonly audit: AuditService,
    private readonly metrics: AdminMetricsService,
  ) {}

  @Get('metrics')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Sprint 107: snapshot agregado (users, alertas, OCR, push, cesta familiar). Cache in-memory 5min. Ver ADR-0007.',
  })
  @ApiOkResponse({ type: AdminMetricsResponseDto })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  @ApiForbiddenResponse({ description: 'Requer role admin' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit 10/min' })
  async getMetrics() {
    return this.metrics.getSnapshot();
  }

  @Get('users')
  @Throttle({ strict: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Sprint 95: lista paginada de users soft-deleted (grace period 30d). ?deleted=true obrigatório, limit cap 50.',
  })
  @ApiOkResponse({ type: SoftDeletedUsersListDto })
  @ApiBadRequestResponse({ description: 'Query inválida (deleted≠true, limit>50)' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  @ApiForbiddenResponse({ description: 'Requer role admin' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit 20/min' })
  async listUsers(@Query() query: ListUsersQueryDto) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    return this.users.adminListSoftDeleted(limit, offset);
  }

  @Post('users/:userId/cancel-delete')
  @Throttle({ strict: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Admin cancela soft-delete de um user (Sprint 92). Idempotente: user já ativo retorna status=already_active.',
  })
  @ApiParam({ name: 'userId', description: 'User soft-deleted (ou já ativo = idempotent)' })
  @ApiOkResponse({ type: CancelDeleteResponseDto })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  @ApiForbiddenResponse({ description: 'Requer role admin' })
  @ApiNotFoundResponse({ description: 'User não encontrado' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit 5/min' })
  async cancelDelete(
    @CurrentUser('id') adminId: string,
    @Param('userId') userId: string,
  ) {
    return this.users.adminCancelDelete(adminId, userId);
  }

  @Get('audit-logs')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Sprint 104: lista paginada de audit logs filtrável por type. Ver ADR-0004.',
  })
  @ApiOkResponse({ type: AuditLogsListDto })
  @ApiBadRequestResponse({ description: 'Types desconhecidos em ?type=...' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  @ApiForbiddenResponse({ description: 'Requer role admin' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit 60/min' })
  async listAuditLogs(@Query() query: ListAuditLogsQueryDto) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    try {
      return await this.audit.list(limit, offset, query.type);
    } catch (err) {
      if ((err as Error).message.startsWith('invalid audit types:')) {
        throw new BadRequestException((err as Error).message);
      }
      throw err;
    }
  }
}
