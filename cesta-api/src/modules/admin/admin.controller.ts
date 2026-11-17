import {
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
import { ListUsersQueryDto } from './dtos/list-users-query.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly users: UsersService) {}

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
}
