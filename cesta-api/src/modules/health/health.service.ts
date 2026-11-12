import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';
import { HealthRepository } from './health.repository';
import { REDIS_HEALTH_CLIENT } from './redis-health.provider';

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
export class HealthService implements OnModuleDestroy {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly repo: HealthRepository,
    @Inject(REDIS_HEALTH_CLIENT) private readonly redis: Redis,
  ) {
    this.redis.on('error', (err) => {
      this.logger.debug(`Redis health client error: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
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
