import type { INestApplication } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Sprint 204 — OpenAPI/Swagger autogen.
 *
 * Mount em /api/docs (default dev + staging). Prod opt-in via SWAGGER_ENABLED=true
 * pra evitar exposição de surface interno. Preserva CORS, prefix global e
 * guards NestJS — route /api/docs permanece pública por default (no auth
 * guard), mas config flag permite suprimir completamente em prod.
 *
 * Lógica env:
 *   - SWAGGER_ENABLED=true → monta sempre (dev + prod).
 *   - SWAGGER_ENABLED não setado + NODE_ENV=production → NÃO monta (404).
 *   - SWAGGER_ENABLED não setado + NODE_ENV!=production → monta (default dev).
 *
 * ADR 0021 documenta scope decorator coverage (priority: auth, products,
 * supermarkets, health) + defer S205+ (alerts, favorites, receipts,
 * shopping-lists, family-baskets, catalog-sync, imports, reviews, admin,
 * notifications, expenses, two-factor, family-profiles).
 */

const DOCS_PATH = 'api/docs';

export function isSwaggerEnabled(env: NodeJS.ProcessEnv): boolean {
  const flag = env.SWAGGER_ENABLED;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return env.NODE_ENV !== 'production';
}

export function setupSwagger(
  app: INestApplication,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!isSwaggerEnabled(env)) {
    return false;
  }
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Cesta API')
      .setDescription(
        'API de comparação de preços de supermercados — Comunidade de Madrid. ' +
          'Surface pública: `catálogo` (products, supermarkets, health). ' +
          'Autenticada: `auth`, `favorites`, `shopping-lists`, `alerts`, `receipts`. ' +
          'ADR 0021 cobre scope decorator rollout por sprint.',
      )
      .setVersion('0.2.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT access token — expira 15min, refresh via cookie httpOnly',
        },
        'bearer',
      )
      .addServer('http://localhost:3001', 'local dev')
      .addServer('https://cesta-api.onrender.com', 'production (SUSPENDED 2026-11-26)')
      .addTag('Auth', 'Register, login, logout, refresh, 2FA, DSR')
      .addTag('Products', 'Catálogo produtos + preços + nutri-score')
      .addTag('Supermarkets', 'Rede de supermercados ativos')
      .addTag('Health', 'Readiness/liveness probes')
      .build(),
  );
  SwaggerModule.setup(DOCS_PATH, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
  new Logger('Swagger').log(`Docs served at /${DOCS_PATH}`);
  return true;
}
