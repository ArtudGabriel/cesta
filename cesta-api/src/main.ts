import { getQueueToken } from '@nestjs/bullmq';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Queue } from 'bullmq';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { CATALOG_SYNC_QUEUE } from './modules/catalog-sync/catalog-sync.processor';
import {
  buildVercelPreviewRegex,
  isAllowedOrigin,
  isRejectedPreflight,
  parseCorsWhitelist,
} from './common/cors/cors-origin';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { initSentry } from './common/sentry/sentry.init';

async function bootstrap(): Promise<void> {
  initSentry();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  // Sprint 76 (P5): gzip de responses JSON — ~70% redução em payloads de
  // catálogo (listas de produtos). Vercel adiciona Brotli automaticamente
  // no frontend; Render pode adicionar br na edge sobre o gzip do app.
  app.use(compression());
  app.use(cookieParser());
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });
  app.setGlobalPrefix('api/v1', {
    exclude: ['uploads/(.*)', 'health', 'health/deep'],
  });
  app.enableShutdownHooks();
  const corsWhitelist = parseCorsWhitelist(
    config.get<string>('CORS_ORIGIN', 'http://localhost:3000'),
  );
  const vercelPreviewRegex = buildVercelPreviewRegex(
    config.get<string>('VERCEL_TEAM_SLUG', ''),
  );
  // Sprint 82: QA Sprint 80 viu OPTIONS → 404 pra origem fora do whitelist.
  // Pacote `cors` em callback(null,false) suprime ACAO e chama next(); Nest
  // não tem handler de OPTIONS registrado → 404. Interceptamos antes com 403
  // + Vary:Origin (semântica correta pra preflight rejeitada).
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (
      isRejectedPreflight(
        req.method,
        typeof origin === 'string' ? origin : undefined,
        corsWhitelist,
        vercelPreviewRegex,
      )
    ) {
      res.setHeader('Vary', 'Origin');
      res.status(403).end();
      return;
    }
    next();
  });
  app.enableCors({
    origin: (origin, callback) => {
      callback(null, isAllowedOrigin(origin, corsWhitelist, vercelPreviewRegex));
    },
    credentials: true,
    optionsSuccessStatus: 204,
    preflightContinue: false,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const swagger = new DocumentBuilder()
    .setTitle('Cesta API')
    .setDescription('API de comparação de preços de supermercados — Comunidade de Madrid')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

  const port = config.get<number>('PORT', 3001);
  await app.listen(port, '0.0.0.0');
  const logger = new Logger('Bootstrap');
  logger.log(`Cesta API rodando em porta ${port}`);

  // Sprint 110: populate inicial do catálogo via queue, pós-listen() pra
  // nunca travar port scan do Render.
  // Sprint 111: queue.waitUntilReady() do BullMQ não tem timeout nativo; no
  // cold start do Upstash Redis a Promise ficava pending indefinido e o
  // Render matava o container por healthcheck timeout → restart loop. Agora
  // envolvemos em Promise.race com 30s timeout; se Redis não liga, logamos
  // warn e SKIP enqueue (app segue em listening).
  if (process.env.AUTO_SYNC_ON_BOOT === 'true') {
    const REDIS_READY_TIMEOUT_MS = 30_000;
    logger.log('AUTO_SYNC_ON_BOOT=true → waiting Redis ready (timeout 30s)...');
    try {
      const queue = app.get<Queue>(getQueueToken(CATALOG_SYNC_QUEUE));
      await Promise.race([
        queue.waitUntilReady(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  `Redis waitUntilReady timeout ${REDIS_READY_TIMEOUT_MS}ms`,
                ),
              ),
            REDIS_READY_TIMEOUT_MS,
          ),
        ),
      ]);
      logger.log('Redis ready, enqueueing bootstrap-sync mercadona...');
      await queue.add(
        'bootstrap-sync',
        { supermarketSlug: 'mercadona' },
        // Sprint 113: BullMQ v4+ rejeita ':' em Custom Id ("Custom Id cannot
        // contain :"). Troca 'bootstrap:mercadona' → 'bootstrap-mercadona'.
        { jobId: 'bootstrap-mercadona', removeOnComplete: 10, removeOnFail: 10 },
      );
      logger.log('bootstrap-sync mercadona enqueued');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`AUTO_SYNC_ON_BOOT skip enqueue: ${message}`);
    }
  }
}

bootstrap();
