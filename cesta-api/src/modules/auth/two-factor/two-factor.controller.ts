import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { AuthRequestContext } from '../auth.service';
import { AuthResponseDto, AuthWireResponse } from '../dtos/auth-response.dto';
import { ChallengeTwoFactorDto } from './dtos/challenge.dto';
import { DisableTwoFactorDto } from './dtos/disable.dto';
import { RecoveryTwoFactorDto } from './dtos/recovery.dto';
import { VerifyTwoFactorDto } from './dtos/verify.dto';
import { TwoFactorService } from './two-factor.service';

const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function requestContext(req: Request): AuthRequestContext {
  return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  });
}

function toWire(result: AuthResponseDto): AuthWireResponse {
  return {
    user: result.user,
    tokens: {
      accessToken: result.tokens.accessToken,
      expiresIn: result.tokens.expiresIn,
    },
  };
}

@ApiTags('Auth 2FA')
@Controller('auth/2fa')
export class TwoFactorController {
  constructor(private readonly service: TwoFactorService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('enroll')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Inicia enroll TOTP (gera secret + QR)' })
  @HttpCode(HttpStatus.OK)
  enroll(@CurrentUser('id') userId: string) {
    return this.service.enroll(userId);
  }

  // 30 tentativas/dia → Sprint 99 ADR 0002. Inline override do throttler
  // `default` (named global = leak vazaria pra todas rotas, ver ADR 0001 S98).
  @Throttle({ default: { limit: 30, ttl: 24 * 60 * 60 * 1000 } })
  @Post('verify')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirma enroll com código TOTP' })
  @HttpCode(HttpStatus.OK)
  verify(
    @CurrentUser('id') userId: string,
    @Body() dto: VerifyTwoFactorDto,
  ) {
    return this.service.verify(userId, dto.code);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @Post('challenge')
  @ApiOperation({ summary: '2ª fase do login quando 2FA habilitado' })
  @HttpCode(HttpStatus.OK)
  async challenge(
    @Body() dto: ChallengeTwoFactorDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthWireResponse> {
    const result = await this.service.challenge(
      dto.partialToken,
      dto.code,
      requestContext(req),
    );
    setRefreshCookie(res, result.tokens.refreshToken);
    return toWire(result);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @Post('recovery')
  @ApiOperation({ summary: 'Login via backup code' })
  @HttpCode(HttpStatus.OK)
  async recovery(
    @Body() dto: RecoveryTwoFactorDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthWireResponse> {
    const result = await this.service.recovery(
      dto.partialToken,
      dto.backupCode,
      requestContext(req),
    );
    setRefreshCookie(res, result.tokens.refreshToken);
    return toWire(result);
  }

  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @Post('disable')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Desabilita 2FA (senha + código)' })
  @HttpCode(HttpStatus.OK)
  disable(
    @CurrentUser('id') userId: string,
    @Body() dto: DisableTwoFactorDto,
  ) {
    return this.service.disable(userId, dto.password, dto.code);
  }
}
