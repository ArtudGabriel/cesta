import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { HealthRepository } from './health.repository';

export interface CheckResult {
  status: 'ok' | 'down';
  latencyMs: number;
  error?: string;
}

export interface HealthReport {
  status: 'ok' | 'degraded';
  uptime: number;
  timestamp: string;
  checks: {
    db: CheckResult;
    redis: CheckResult;
  };
}

const CHECK_TIMEOUT_MS = 1000;

@Injectable()
export class HealthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HealthService.name);
  private redis!: Redis;

  constructor(
    private readonly repo: HealthRepository,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const url = this.config.getOrThrow<string>('REDIS_URL');
    this.redis = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      enableReadyCheck: false,
      connectTimeout: CHECK_TIMEOUT_MS,
    });
    this.redis.on('error', (err) => {
      this.logger.debug(`Redis health client error: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit().catch(() => undefined);
    }
  }

  async checkDb(): Promise<CheckResult> {
    const start = Date.now();
    try {
      await withTimeout(this.repo.pingDb(), CHECK_TIMEOUT_MS);
      return { status: 'ok', latencyMs: Date.now() - start };
    } catch (err) {
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async checkRedis(): Promise<CheckResult> {
    const start = Date.now();
    try {
      await withTimeout(this.redis.ping(), CHECK_TIMEOUT_MS);
      return { status: 'ok', latencyMs: Date.now() - start };
    } catch (err) {
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async report(): Promise<HealthReport> {
    const [db, redis] = await Promise.all([this.checkDb(), this.checkRedis()]);
    const status: 'ok' | 'degraded' =
      db.status === 'ok' && redis.status === 'ok' ? 'ok' : 'degraded';
    return {
      status,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks: { db, redis },
    };
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms);
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch((e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}
