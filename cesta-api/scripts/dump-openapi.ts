/**
 * Sprint 209 — openapi-typescript CI gate (ADR 0022).
 *
 * Bootstraps Nest app em modo offline (sem app.listen) e escreve o OpenAPI
 * spec canônico pra stdout OU pro path passado em argv[2]. Consumido por:
 *   - `cesta-web/scripts/generate-api-types.mjs` (regen client types)
 *   - gates CI (types:api:check — detect drift schema ↔ frontend types)
 *
 * Usage:
 *   ts-node scripts/dump-openapi.ts             # stdout
 *   ts-node scripts/dump-openapi.ts out.json    # file
 *
 * O AppModule depende de config env (DATABASE_URL + JWT secrets + REDIS_URL)
 * via class-validator. Em modo dump, preenche defaults seguros ANTES do
 * import pra que validateSync() do env.validation passe sem precisar de
 * .env local nem connect real. CESTA_OPENAPI_DUMP=1 ativa guards extras:
 * PrismaService.onModuleInit skip $connect (DB offline OK) e qualquer
 * processor setImmediate cron pode rodar inofensivo pós dump+close.
 */

process.env.CESTA_OPENAPI_DUMP = '1';
process.env.NODE_ENV = process.env.NODE_ENV ?? 'development';
process.env.SWAGGER_ENABLED = process.env.SWAGGER_ENABLED ?? 'true';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://dump:dump@localhost:5432/dump';
process.env.JWT_ACCESS_SECRET_CURRENT =
  process.env.JWT_ACCESS_SECRET_CURRENT ?? 'openapi-dump-access-secret-32-chars-aaa';
process.env.JWT_REFRESH_SECRET_CURRENT =
  process.env.JWT_REFRESH_SECRET_CURRENT ?? 'openapi-dump-refresh-secret-32-chars-xyz';
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
process.env.TWO_FACTOR_ENC_KEY =
  process.env.TWO_FACTOR_ENC_KEY ?? 'openapi-dump-two-factor-key-16+chars';
process.env.R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID ?? 'dump';
process.env.R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY ?? 'dump';
process.env.R2_BUCKET = process.env.R2_BUCKET ?? 'cesta-dump';
process.env.R2_PUBLIC_BASE_URL =
  process.env.R2_PUBLIC_BASE_URL ?? 'https://dump.r2.local';
process.env.R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? 'dump';
process.env.R2_S3_ENDPOINT =
  process.env.R2_S3_ENDPOINT ?? 'https://dump.r2.local';

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { writeFileSync } from 'fs';
import { AppModule } from '../src/app.module';
import { buildSwaggerDocument } from '../src/swagger/swagger.setup';

async function dump(): Promise<void> {
  const logger = new Logger('OpenAPIDump');
  const app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  const document = buildSwaggerDocument(app);
  const json = JSON.stringify(document, null, 2);
  const outPath = process.argv[2];
  if (outPath) {
    writeFileSync(outPath, json + '\n', 'utf8');
    logger.log(`wrote spec → ${outPath} (${json.length} bytes)`);
  } else {
    process.stdout.write(json + '\n');
  }
  // Sprint 209 (ADR 0022): app.close() em dump mode engancha no
  // BullMQ worker shutdown handshake (ioredis reconnect loop). Como o
  // único objetivo do script é extrair metadata, exit explícito pós-dump
  // é seguro — nenhum recurso persistente foi aberto além de sockets TCP
  // que o kernel limpa na saída do processo.
  process.exit(0);
}

dump().catch((err) => {
  console.error('dump-openapi failed:', err);
  process.exit(1);
});
