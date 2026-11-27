import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt()
  @Min(1)
  PORT: number = 3001;

  @IsString()
  CORS_ORIGIN: string;

  @IsString()
  DATABASE_URL: string;

  // Sprint 92 rotação: CURRENT assina + verifica primeiro; PREVIOUS cobre
  // janela de overlap zero-downtime. README documenta procedimento.
  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET_CURRENT: string;

  @IsOptional()
  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET_PREVIOUS?: string;

  @IsString()
  @MinLength(32)
  JWT_REFRESH_SECRET_CURRENT: string;

  @IsOptional()
  @IsString()
  @MinLength(32)
  JWT_REFRESH_SECRET_PREVIOUS?: string;

  @IsString()
  JWT_ACCESS_EXPIRES_IN: string = '15m';

  @IsString()
  JWT_REFRESH_EXPIRES_IN: string = '7d';

  @IsString()
  REDIS_URL: string;

  @IsString()
  @MinLength(1)
  VAPID_PUBLIC_KEY: string = 'disabled';

  @IsString()
  @MinLength(1)
  VAPID_PRIVATE_KEY: string = 'disabled';

  @IsString()
  VAPID_SUBJECT: string = 'mailto:contact@cesta.app';

  @IsString()
  @MinLength(1)
  RESEND_API_KEY: string = 'disabled';

  // Sprint 227 (#5 bundle): Render prod expõe `RESEND_FROM_ADDRESS` +
  // `RESEND_FROM_DOMAIN` separados (dominio verificado em Resend). Código
  // antigo lia um unico `RESEND_FROM='Cesta <noreply@cesta.app>'` que nunca
  // existiu em prod — fallback default mandava com `cesta.app` nao
  // verificado, Resend recusava silencioso. Replace in place: compomos
  // From no EmailService a partir dos 2 valores.
  @IsString()
  RESEND_FROM_ADDRESS: string = 'noreply';

  @IsString()
  RESEND_FROM_DOMAIN: string = 'cesta.app';

  @IsOptional()
  @IsString()
  RESEND_FROM_NAME?: string = 'Cesta';

  @IsString()
  EMAIL_VERIFY_BASE_URL: string = 'http://localhost:3000';

  // Sprint 87: team slug Vercel usado pra montar regex de preview URL (CORS).
  // Default mantém compat; mudar só se o time no Vercel for renomeado.
  @IsString()
  VERCEL_TEAM_SLUG: string = 'gabriels-projects-f5aa3b24';

  // Sprint 94: hora UTC do cron grace-reminder. Default 9h UTC (10h Madrid
  // horário padrão, 11h horário verão). Permite deslocar em ambientes de
  // staging sem redeploy. Valor 0-23.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  CRON_GRACE_REMINDER_HOUR?: number = 9;

  // Sprint 99: chave pra cifrar User.twoFactorSecret em repouso (AES-256-GCM).
  // Normalizada via SHA-256 em runtime pra 32 bytes. Perder a chave = perder
  // todos os 2FAs ativos. ADR 0002 documenta rotação.
  @IsString()
  @MinLength(16)
  TWO_FACTOR_ENC_KEY: string;

  // Sprint 109: enfileira 1 bootstrap-sync mercadona no onApplicationBootstrap.
  // Setar durante janela de populate inicial — Manager remove depois.
  // Sprint 187 (nit S109 P3): parse robusto em main.ts aceita variações case
  // + trailing whitespace. Valores truthy aceitos: 'true', 'TRUE', 'True', '1',
  // qualquer um com leading/trailing spaces. Anything else = disabled.
  @IsOptional()
  @IsString()
  AUTO_SYNC_ON_BOOT?: string;

  // Sprint 213 (ADR 0025 — Render bandwidth mitigation 2026-11-26):
  // Habilita pipeline backfill-images (cron scan OFF + from-source via catalog-sync).
  // Default 'false' pra desabilitar em prod Render enquanto bandwidth outbound
  // está sob pressão. Workflow alternativo: GitHub Actions cron (ADR 0025 G2),
  // ou rodar script local manual pra poblar imageUrl. Valores truthy: 'true',
  // 'TRUE', 'True', '1' (parse em is-backfill-enabled.ts).
  @IsOptional()
  @IsString()
  BACKFILL_IMAGES_ENABLED?: string;
}

export function validateEnv(raw: Record<string, unknown>) {
  const config = plainToInstance(EnvironmentVariables, raw, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(config, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(
      `Invalid environment variables:\n${errors
        .map((e) => `  ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
        .join('\n')}`,
    );
  }
  return config;
}
