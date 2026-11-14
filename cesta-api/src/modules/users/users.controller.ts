import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ConsentDto } from './dtos/consent.dto';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { UsersService } from './users.service';

@ApiBearerAuth()
@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Perfil do usuário autenticado' })
  me(@CurrentUser('id') userId: string) {
    return this.users.getProfile(userId);
  }

  @Patch('me')
  @Throttle({ write: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Atualiza name e/ou locale do usuário autenticado' })
  update(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.users.updateProfile(userId, dto);
  }

  @Post('me/consent')
  @Throttle({ write: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Persiste GDPR cookie consent (Sprint 62). Payload { level: "all" | "essential" }.',
  })
  async consent(
    @CurrentUser('id') userId: string,
    @Body() dto: ConsentDto,
  ): Promise<void> {
    await this.users.saveConsent(userId, dto.level);
  }
}
