import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminGuard } from '../../common/guards/admin.guard';
import { UsersService } from '../users/users.service';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly users: UsersService) {}

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
