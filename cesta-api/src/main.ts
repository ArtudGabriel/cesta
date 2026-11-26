import { getQueueToken } from '@nestjs/bullmq';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Queue } from 'bullmq';
import compression from 'compression';
import cookieParser from 'cookie-parser';
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
    // Sprint 193: /ready adicionado pro K8s/Render readiness probe convention
    // (controller /ready alias de /health/deep). Sem exclude a rota cai em
    // /api/v1/ready, quebra idiom prometido no PR body.
    exclude: ['uploads/(.*)', 'health', 'health/deep', 'ready'],
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
  // Sprint 187 (nit S109 P3): parse robusta do flag — aceita 'true', 'TRUE',
  // '1', com trailing/leading whitespace. Strict === 'true' silenciava no-op
  // em misconfig ops (variação de case / espaço no dashboard).
  const autoSyncFlag = (process.env.AUTO_SYNC_ON_BOOT ?? '').trim().toLowerCase();
  if (autoSyncFlag === 'true' || autoSyncFlag === '1') {
    const REDIS_READY_TIMEOUT_MS = 30_000;
    // Sprint 119: expande bootstrap pra múltiplos adapters.
    // Sprint 121: pivot default para 'mercadona,dia' — Carrefour removido do
    // default por Akamai 403 persistente (S120 warmup+cookie não bypass JS
    // challenge). Carrefour volta via Puppeteer em sprint futuro. DIA tem
    // menos proteção anti-bot. Env `AUTO_SYNC_ON_BOOT_SLUGS` override opcional.
    // Sprint 130: disable Puppeteer slugs (carrefour, alcampo, eroski) por
    // OOM confirmado Render free tier 512MB (event server_failed oomKilled
    // 2026-11-19 22:49:24Z). Chromium headless ~300MB + Node heap ~150MB
    // estoura margem. Default agora é 4 adapters leves (politeFetch/Cheerio
    // ~50MB). Puppeteer adapters permanecem no repo mas não bootam auto —
    // reabilitar via `AUTO_SYNC_ON_BOOT_SLUGS` override em Pro plan OR
    // migração pra servidor maior.
    const slugs = (
      process.env.AUTO_SYNC_ON_BOOT_SLUGS ?? 'mercadona,dia,lidl,aldi'
    )
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    logger.log(
      `AUTO_SYNC_ON_BOOT=true → waiting Redis ready (timeout 30s) for slugs=[${slugs.join(',')}]...`,
    );
    // Sprint 187 (nit S111 P3): captura handle + clearTimeout no winner. Antes
    // o setTimeout continuava agendado 30s mesmo após waitUntilReady vencer a
    // race, mantendo o event loop vivo e atrasando graceful shutdown.
    let timeoutHandle: NodeJS.Timeout | undefined;
    try {
      const queue = app.get<Queue>(getQueueToken(CATALOG_SYNC_QUEUE));
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () =>
            reject(
              new Error(
                `Redis waitUntilReady timeout ${REDIS_READY_TIMEOUT_MS}ms`,
              ),
            ),
          REDIS_READY_TIMEOUT_MS,
        );
      });
      await Promise.race([queue.waitUntilReady(), timeoutPromise]);
      if (timeoutHandle) clearTimeout(timeoutHandle);
      for (const slug of slugs) {
        try {
          await queue.add(
            'bootstrap-sync',
            { supermarketSlug: slug },
            // Sprint 115: sem jobId (dedup silencioso BullMQ bloqueava reruns).
            // removeOnComplete:10 mantém backlog enxuto.
            { removeOnComplete: 10, removeOnFail: 10 },
          );
          logger.log(`bootstrap-sync ${slug} enqueued`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.warn(`bootstrap-sync ${slug} skip: ${message}`);
        }
      }
    } catch (err) {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`AUTO_SYNC_ON_BOOT skip enqueue: ${message}`);
    }
  }
}

bootstrap();
