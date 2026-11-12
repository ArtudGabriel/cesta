import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthRepository } from './health.repository';
import { HealthService } from './health.service';
import { RedisHealthClientProvider } from './redis-health.provider';

@Module({
  controllers: [HealthController],
  providers: [HealthService, HealthRepository, RedisHealthClientProvider],
})
export class HealthModule {}
