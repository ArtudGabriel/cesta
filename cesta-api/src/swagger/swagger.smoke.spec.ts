import { INestApplication, Module, Controller, Get } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiTags } from '@nestjs/swagger';
import request from 'supertest';
import { setupSwagger } from './swagger.setup';

/**
 * Sprint 204 — smoke spec /api/docs.
 *
 * Isola do AppModule real (evita setup Prisma + BullMQ + Redis cold-boot
 * ~15s) usando controller mínimo + setupSwagger direto. Objetivo: provar
 * que o toggle env serve /api/docs HTML em dev e retorna 404 em prod.
 */

@Controller('smoke')
class SmokeController {
  @Get()
  @ApiTags('Smoke')
  ping() {
    return { ok: true };
  }
}

@Module({ controllers: [SmokeController] })
class SmokeModule {}

async function bootstrap(
  env: NodeJS.ProcessEnv,
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [SmokeModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  setupSwagger(app, env);
  await app.init();
  return app;
}

describe('Swagger /api/docs smoke', () => {
  let app: INestApplication;

  afterEach(async () => {
    if (app) await app.close();
  });

  it('dev default → GET /api/docs/ serve HTML 200', async () => {
    app = await bootstrap({ NODE_ENV: 'development' } as NodeJS.ProcessEnv);
    const res = await request(app.getHttpServer())
      .get('/api/docs/')
      .expect(200);
    expect(res.text).toMatch(/swagger-ui/i);
  });

  it('prod default (no flag) → GET /api/docs/ 404', async () => {
    app = await bootstrap({ NODE_ENV: 'production' } as NodeJS.ProcessEnv);
    await request(app.getHttpServer()).get('/api/docs/').expect(404);
  });

  it('prod + SWAGGER_ENABLED=true → GET /api/docs/ serve HTML 200', async () => {
    app = await bootstrap({
      NODE_ENV: 'production',
      SWAGGER_ENABLED: 'true',
    } as NodeJS.ProcessEnv);
    const res = await request(app.getHttpServer())
      .get('/api/docs/')
      .expect(200);
    expect(res.text).toMatch(/swagger-ui/i);
  });

  it('JSON spec /api/docs-json disponível quando enabled', async () => {
    app = await bootstrap({ NODE_ENV: 'development' } as NodeJS.ProcessEnv);
    const res = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    expect(res.body).toHaveProperty('openapi');
    expect(res.body.info.title).toBe('Cesta API');
  });
});
