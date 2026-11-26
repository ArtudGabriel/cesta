import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    // Sprint 209 (ADR 0022): openapi dump script bootstrap-a AppModule sem DB.
    // CESTA_OPENAPI_DUMP=1 skip $connect pra extração de spec offline.
    if (process.env.CESTA_OPENAPI_DUMP === '1') {
      this.logger.log('Prisma $connect skipped (CESTA_OPENAPI_DUMP=1)');
      return;
    }
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    if (process.env.CESTA_OPENAPI_DUMP === '1') {
      return;
    }
    await this.$disconnect();
  }
}
