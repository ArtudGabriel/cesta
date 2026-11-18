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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminGuard } from '../../common/guards/admin.guard';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { ListAuditLogsQueryDto } from './dtos/list-audit-logs-query.dto';
import { ListUsersQueryDto } from './dtos/list-users-query.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Get('users')
  @Throttle({ strict: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Sprint 95: lista paginada de users soft-deleted (grace period 30d). ?deleted=true obrigatório, limit cap 50.',
  })
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
