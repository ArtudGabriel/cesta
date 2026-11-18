import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../audit/audit.service';

export interface JwtPayload {
  sub: string;
  roles: string[];
  iat?: number;
  exp?: number;
}

/**
 * Sprint 92: assinatura usa sempre o secret CURRENT; verificação tenta CURRENT
 * primeiro e cai pra PREVIOUS quando configurado — janela de overlap durante
 * rotação zero-downtime. Procedimento em README (seção "JWT secret rotation").
 */
@Injectable()
export class JwtRotationService implements OnModuleInit {
  private readonly logger = new Logger(JwtRotationService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    const prevAccess = this.config.get<string>('JWT_ACCESS_SECRET_PREVIOUS');
    const prevRefresh = this.config.get<string>('JWT_REFRESH_SECRET_PREVIOUS');
    const kinds: string[] = [];
    if (prevAccess) kinds.push('access');
    if (prevRefresh) kinds.push('refresh');
    if (kinds.length > 0) {
      this.logger.log(
        `[audit] SecretRotated kinds=${kinds.join(',')} ts=${new Date().toISOString()}`,
      );
      // fire-and-forget: boot não aguarda
      void this.audit.record({
        type: 'SecretRotated',
        metadata: { kinds },
      });
    }
  }

  signAccess(payload: JwtPayload, expiresIn: string): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.accessCurrent(),
      expiresIn: expiresIn as unknown as number,
    });
  }

  signRefresh(payload: JwtPayload, expiresIn: string): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.refreshCurrent(),
      expiresIn: expiresIn as unknown as number,
    });
  }

  verifyAccess<T extends object = JwtPayload>(token: string): Promise<T> {
    return this.verifyWithFallback<T>(
      token,
      this.accessCurrent(),
      this.accessPrevious(),
    );
  }

  verifyRefresh<T extends object = JwtPayload>(token: string): Promise<T> {
    return this.verifyWithFallback<T>(
      token,
      this.refreshCurrent(),
      this.refreshPrevious(),
    );
  }

  private accessCurrent(): string {
    return this.config.getOrThrow<string>('JWT_ACCESS_SECRET_CURRENT');
  }

  private accessPrevious(): string | undefined {
    return this.config.get<string>('JWT_ACCESS_SECRET_PREVIOUS');
  }

  private refreshCurrent(): string {
    return this.config.getOrThrow<string>('JWT_REFRESH_SECRET_CURRENT');
  }

  private refreshPrevious(): string | undefined {
    return this.config.get<string>('JWT_REFRESH_SECRET_PREVIOUS');
  }

  private async verifyWithFallback<T extends object>(
    token: string,
    current: string,
    previous: string | undefined,
  ): Promise<T> {
    try {
      return await this.jwt.verifyAsync<T>(token, { secret: current });
    } catch (err) {
      if (!previous) throw err;
      return this.jwt.verifyAsync<T>(token, { secret: previous });
    }
  }
}
