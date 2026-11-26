import type { INestApplication } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
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
 * ADR 0021 Closed (S208) — 17/17 controllers decorated: auth, products,
 * supermarkets, health (S204); reviews, favorites, shopping-lists (S205);
 * alerts, receipts, expenses (S206); family-profiles, family-baskets,
 * catalog-sync (S207); imports, admin, two-factor, notifications (S208).
 */

const DOCS_PATH = 'api/docs';

export function isSwaggerEnabled(env: NodeJS.ProcessEnv): boolean {
  const flag = env.SWAGGER_ENABLED;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return env.NODE_ENV !== 'production';
}

/**
 * Sprint 209 — extraído de setupSwagger pra permitir dump offline do spec
 * (scripts/dump-openapi.ts consume isso pra client types generation CI gate,
 * ADR 0022). A config vive em uma única fonte — tags + description + servers
 * compartilhados entre /api/docs mount e openapi.json export.
 */
export function buildSwaggerDocument(app: INestApplication): OpenAPIObject {
  return SwaggerModule.createDocument(
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
      .addTag('Alerts', 'Alertas de preço + regras combo/trend/bundle')
      .addTag('Receipts', 'Upload de notas fiscais + OCR async + items')
      .addTag('Expenses', 'Agregados de gasto (summary/category/supermarket/top-products)')
      .addTag('Family Profiles', 'Perfil familiar + questionário dietético (PT/ES)')
      .addTag('Family Baskets', 'Cesta familiar gerada (async worker) + edição de items')
      .addTag('Catalog Sync', 'Admin — trigger + histórico de sync de adapters de supermercado')
      .addTag('User CSV Import', 'Import GDPR Art. 20 (ZIP → dry-run + apply)')
      .addTag('Admin', 'Metrics snapshot + soft-deleted users + audit logs')
      .addTag('Auth 2FA', 'Enroll/verify TOTP + login challenge/recovery + disable')
      .addTag('Notifications', 'Push subscriptions (VAPID key fetch)')
      .build(),
  );
}

export function setupSwagger(
  app: INestApplication,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!isSwaggerEnabled(env)) {
    return false;
  }
  const document = buildSwaggerDocument(app);
  SwaggerModule.setup(DOCS_PATH, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
  new Logger('Swagger').log(`Docs served at /${DOCS_PATH}`);
  return true;
}
