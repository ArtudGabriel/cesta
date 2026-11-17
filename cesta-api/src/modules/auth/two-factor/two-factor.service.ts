import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { randomBytes } from 'crypto';
import { AppException } from '../../../common/exceptions/app-exception';
import { UsersService } from '../../users/users.service';
import { AuthRepository } from '../auth.repository';
import { JwtRotationService } from '../jwt-rotation.service';
import { AuthResponseDto, AuthTokensDto } from '../dtos/auth-response.dto';
import { UserResponseDto } from '../../users/dtos/user-response.dto';
import { TwoFactorEncryptionService } from './encryption.service';
import { TwoFactorRepository } from './two-factor.repository';
import {
  DisableResponseDto,
  EnrollResponseDto,
  TwoFactorChallengeResponseDto,
  VerifyResponseDto,
} from './dtos/responses.dto';
import { AuthRequestContext } from '../auth.service';

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_TTL_DAYS = 7;
const PARTIAL_TOKEN_TTL_SEC = 300; // 5min
const BACKUP_CODE_COUNT = 10;
const ISSUER = 'Cesta';
const TOTP_WINDOW = 1; // aceita ±30s de clock skew

authenticator.options = { window: TOTP_WINDOW };

export interface PartialTokenPayload {
  sub: string;
  scope: '2fa_pending';
  jti: string;
}

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly usersService: UsersService,
    private readonly repo: TwoFactorRepository,
    private readonly encryption: TwoFactorEncryptionService,
    private readonly rotation: JwtRotationService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly authRepo: AuthRepository,
  ) {}

  async enroll(userId: string): Promise<EnrollResponseDto> {
    const user = await this.usersService.findById(userId);
    if (user.twoFactorEnabled) {
      throw new AppException(
        'AUTH.2FA.ALREADY_ENABLED',
        '2FA já está habilitado',
        HttpStatus.CONFLICT,
      );
    }
    const secret = authenticator.generateSecret();
    const label = user.email ?? user.phone ?? user.id;
    const otpauthUrl = authenticator.keyuri(label, ISSUER, secret);
    const qrCodeDataUri = await QRCode.toDataURL(otpauthUrl);

    await this.repo.setPendingSecret(userId, this.encryption.encrypt(secret));
    return { secret, qrCodeDataUri, otpauthUrl };
  }

  async verify(userId: string, code: string): Promise<VerifyResponseDto> {
    const user = await this.usersService.findById(userId);
    if (user.twoFactorEnabled) {
      throw new AppException(
        'AUTH.2FA.ALREADY_ENABLED',
        '2FA já está habilitado',
        HttpStatus.CONFLICT,
      );
    }
    if (!user.twoFactorSecret) {
      throw new AppException(
        'AUTH.2FA.NO_PENDING_ENROLL',
        'Nenhum enroll pendente',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const secret = this.encryption.decrypt(user.twoFactorSecret);
    if (!authenticator.check(code, secret)) {
      throw new AppException(
        'AUTH.2FA.INVALID_CODE',
        'Código inválido',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const plainCodes = this.generateBackupCodes();
    const hashed = await Promise.all(
      plainCodes.map((c) => bcrypt.hash(c, BCRYPT_ROUNDS)),
    );
    await this.repo.enable(userId, hashed);
    return { enabled: true, backupCodes: plainCodes };
  }

  async issuePartialToken(
    userId: string,
  ): Promise<TwoFactorChallengeResponseDto> {
    const jti = randomBytes(16).toString('hex');
    const payload: PartialTokenPayload = {
      sub: userId,
      scope: '2fa_pending',
      jti,
    };
    const secret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET_CURRENT');
    const partialToken = await this.jwt.signAsync(payload, {
      secret,
      expiresIn: PARTIAL_TOKEN_TTL_SEC,
    });
    return { status: '2FA_REQUIRED', partialToken };
  }

  async challenge(
    partialToken: string,
    code: string,
    ctx: AuthRequestContext,
  ): Promise<AuthResponseDto> {
    const payload = await this.verifyPartialToken(partialToken);
    const user = await this.usersService.findById(payload.sub);
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw this.invalidCode();
    }
    const secret = this.encryption.decrypt(user.twoFactorSecret);
    if (!authenticator.check(code, secret)) {
      throw this.invalidCode();
    }
    const tokens = await this.issueTokens(user.id, user.roles, ctx);
    return { user: UserResponseDto.fromEntity(user), tokens };
  }

  async recovery(
    partialToken: string,
    backupCode: string,
    ctx: AuthRequestContext,
  ): Promise<AuthResponseDto> {
    const payload = await this.verifyPartialToken(partialToken);
    const user = await this.usersService.findById(payload.sub);
    if (!user.twoFactorEnabled || user.twoFactorBackupCodes.length === 0) {
      throw this.invalidCode();
    }
    const remaining: string[] = [];
    let matched = false;
    for (const hash of user.twoFactorBackupCodes) {
      if (!matched && (await bcrypt.compare(backupCode, hash))) {
        matched = true;
        continue;
      }
      remaining.push(hash);
    }
    if (!matched) throw this.invalidCode();
    await this.repo.consumeBackupCode(user.id, remaining);
    const tokens = await this.issueTokens(user.id, user.roles, ctx);
    return { user: UserResponseDto.fromEntity(user), tokens };
  }

  async disable(
    userId: string,
    password: string,
    code: string,
  ): Promise<DisableResponseDto> {
    const user = await this.usersService.findById(userId);
    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      throw new AppException(
        'AUTH.2FA.INVALID_CREDENTIALS',
        'Senha ou código inválidos',
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new AppException(
        'AUTH.2FA.NOT_ENABLED',
        '2FA não está habilitado',
        HttpStatus.BAD_REQUEST,
      );
    }
    const secret = this.encryption.decrypt(user.twoFactorSecret);
    if (!authenticator.check(code, secret)) {
      throw new AppException(
        'AUTH.2FA.INVALID_CREDENTIALS',
        'Senha ou código inválidos',
        HttpStatus.UNAUTHORIZED,
      );
    }
    await this.repo.disable(userId);
    return { enabled: false };
  }

  private async verifyPartialToken(
    token: string,
  ): Promise<PartialTokenPayload> {
    try {
      const payload = await this.rotation.verifyAccess<PartialTokenPayload>(
        token,
      );
      if (payload.scope !== '2fa_pending' || !payload.sub) {
        throw new Error('invalid scope');
      }
      return payload;
    } catch {
      throw new AppException(
        'AUTH.2FA.PARTIAL_TOKEN_INVALID',
        'Token temporário inválido ou expirado',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  private invalidCode(): AppException {
    return new AppException(
      'AUTH.2FA.INVALID_CODE',
      'Código inválido',
      HttpStatus.UNAUTHORIZED,
    );
  }

  private generateBackupCodes(): string[] {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length: BACKUP_CODE_COUNT }, () => {
      const bytes = randomBytes(10);
      let out = '';
      for (let i = 0; i < 10; i++) {
        out += alphabet[bytes[i] % alphabet.length];
      }
      return out;
    });
  }

  private async issueTokens(
    userId: string,
    roles: string[],
    ctx: AuthRequestContext,
  ): Promise<AuthTokensDto> {
    const payload = { sub: userId, roles };
    const accessExpires = this.config.get<string>(
      'JWT_ACCESS_EXPIRES_IN',
      '15m',
    );
    const refreshExpires = this.config.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    );
    const accessToken = await this.rotation.signAccess(payload, accessExpires);
    const refreshToken = await this.rotation.signRefresh(
      payload,
      refreshExpires,
    );
    const tokenHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
    const expiresAt = new Date(
      Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
    await this.authRepo.createRefreshToken({
      userId,
      tokenHash,
      expiresAt,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });
    const expiresInSec = this.parseSeconds(accessExpires);
    return { accessToken, refreshToken, expiresIn: expiresInSec };
  }

  private parseSeconds(duration: string): number {
    const m = /^(\d+)([smhd])$/.exec(duration);
    if (!m) return 900;
    const v = parseInt(m[1], 10);
    const u = m[2];
    return v * (u === 's' ? 1 : u === 'm' ? 60 : u === 'h' ? 3600 : 86400);
  }
}
