import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ConsentDto } from './dtos/consent.dto';
import { DeleteAccountDto } from './dtos/delete-account.dto';
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

  @Get('me/export')
  @Throttle({ write: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'GDPR Art. 20 — baixa JSON com todos os dados pessoais do usuário autenticado (Sprint 63).',
  })
  async exportMe(
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Record<string, unknown>> {
    const data = await this.users.exportMyData(userId);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="cesta-datos-${userId}-${timestamp}.json"`,
    );
    return data;
  }

  @Delete('me')
  @Throttle({ strict: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'GDPR Art. 17 — soft-delete da conta + revoga refresh tokens. Body { confirmation: "ELIMINAR" }.',
  })
  async deleteMe(
    @CurrentUser('id') userId: string,
    @Body() _dto: DeleteAccountDto,
  ): Promise<void> {
    await this.users.deleteMyAccount(userId);
  }
}
