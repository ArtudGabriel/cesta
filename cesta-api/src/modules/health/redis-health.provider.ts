import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_HEALTH_CLIENT = 'REDIS_HEALTH_CLIENT';

export const RedisHealthClientProvider = {
  provide: REDIS_HEALTH_CLIENT,
  useFactory: (config: ConfigService): Redis => {
    const url = config.getOrThrow<string>('REDIS_URL');
    return new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      enableReadyCheck: false,
      connectTimeout: 1000,
    });
  },
  inject: [ConfigService],
};
