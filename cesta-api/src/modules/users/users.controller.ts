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
  StreamableFile,
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
  @Throttle({ strict: { limit: 1, ttl: 3_600_000 } })
  @ApiOperation({
    summary:
      'GDPR Art. 20 — baixa ZIP multi-CSV (perfil, favoritos, listas, alertas, reviews, expenses) do usuário autenticado. Rate limit 1/hora (Sprint 91).',
  })
  async exportMe(
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { zip, filename } = await this.users.exportMyData(userId);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.setHeader('Content-Length', String(zip.length));
    return new StreamableFile(zip);
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
