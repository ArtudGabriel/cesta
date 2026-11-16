import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import {
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
  app.setGlobalPrefix('api/v1', { exclude: ['uploads/(.*)', 'health'] });
  app.enableShutdownHooks();
  const corsWhitelist = parseCorsWhitelist(
    config.get<string>('CORS_ORIGIN', 'http://localhost:3000'),
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
      callback(null, isAllowedOrigin(origin, corsWhitelist));
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
  new Logger('Bootstrap').log(`Cesta API rodando em porta ${port}`);
}

bootstrap();
