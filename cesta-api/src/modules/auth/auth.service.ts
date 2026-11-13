import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AppException } from '../../common/exceptions/app-exception';
import { UsersService } from '../users/users.service';
import { UserResponseDto } from '../users/dtos/user-response.dto';
import { AuthRepository } from './auth.repository';
import { AuthResponseDto, AuthTokensDto } from './dtos/auth-response.dto';
import { LoginDto } from './dtos/login.dto';
import { RegisterDto } from './dtos/register.dto';
import { JwtPayload } from './strategies/jwt.strategy';

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_TTL_DAYS = 7;

export interface AuthRequestContext {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly repo: AuthRepository,
  ) {}

  async register(
    dto: RegisterDto,
    ctx: AuthRequestContext = {},
  ): Promise<AuthResponseDto> {
    if (!dto.email && !dto.phone) {
      throw new AppException(
        'AUTH.CONTACT_REQUIRED',
        'Email ou telefone é obrigatório',
        HttpStatus.BAD_REQUEST,
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.usersService.createUser({
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      name: dto.name,
      locale: dto.locale,
    });

    const tokens = await this.issueTokens(user, ctx);
    return { user: UserResponseDto.fromEntity(user), tokens };
  }

  async login(
    dto: LoginDto,
    ctx: AuthRequestContext = {},
  ): Promise<AuthResponseDto> {
    if (!dto.email && !dto.phone) {
      throw new AppException(
        'AUTH.CONTACT_REQUIRED',
        'Email ou telefone é obrigatório',
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = dto.email
      ? await this.usersService.findByEmail(dto.email)
      : await this.usersService.findByPhone(dto.phone!);

    const invalid = new AppException(
      'AUTH.INVALID_CREDENTIALS',
      'Credenciais inválidas',
      HttpStatus.UNAUTHORIZED,
    );
    if (!user || user.deletedAt) throw invalid;

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw invalid;

    const tokens = await this.issueTokens(user, ctx);
    return { user: UserResponseDto.fromEntity(user), tokens };
  }

  async refresh(
    refreshToken: string,
    ctx: AuthRequestContext = {},
  ): Promise<AuthResponseDto> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new AppException(
        'AUTH.REFRESH_INVALID',
        'Refresh token inválido',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const user = await this.usersService.findById(payload.sub);
    const activeTokens = await this.repo.findActiveRefreshTokens(user.id);

    const match = await this.findMatchingToken(activeTokens, refreshToken);
    if (!match) {
      // Replay/reuso detectado — revogar todos como precaução
      await this.repo.revokeAllActive(user.id);
      throw new AppException(
        'AUTH.REFRESH_REPLAY',
        'Refresh token reutilizado',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.repo.revokeById(match.id);

    const tokens = await this.issueTokens(user, ctx);
    return { user: UserResponseDto.fromEntity(user), tokens };
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (!refreshToken) {
      await this.repo.revokeAllActive(userId);
      return;
    }

    const active = await this.repo.findActiveRefreshTokensAnyExpiry(userId);
    const match = await this.findMatchingToken(active, refreshToken);
    if (match) {
      await this.repo.revokeById(match.id);
    }
  }

  async me(userId: string): Promise<UserResponseDto> {
    const user = await this.usersService.findById(userId);
    return UserResponseDto.fromEntity(user);
  }

  private async issueTokens(
    user: User,
    ctx: AuthRequestContext,
  ): Promise<AuthTokensDto> {
    const payload: JwtPayload = { sub: user.id, roles: user.roles };
    const accessExpires = this.config.get<string>(
      'JWT_ACCESS_EXPIRES_IN',
      '15m',
    );
    const refreshExpires = this.config.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    );

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: accessExpires as unknown as number,
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshExpires as unknown as number,
    });

    const tokenHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
    const expiresAt = new Date(
      Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
    await this.repo.createRefreshToken({
      userId: user.id,
      tokenHash,
      expiresAt,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseSecondsFromDuration(accessExpires),
    };
  }

  private async findMatchingToken(
    tokens: { id: string; tokenHash: string }[],
    refreshToken: string,
  ) {
    for (const token of tokens) {
      const ok = await bcrypt.compare(refreshToken, token.tokenHash);
      if (ok) return token;
    }
    return null;
  }

  private parseSecondsFromDuration(duration: string): number {
    const match = /^(\d+)([smhd])$/.exec(duration);
    if (!match) return 900;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multiplier =
      unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
    return value * multiplier;
  }
}
