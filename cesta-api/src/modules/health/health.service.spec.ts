import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthRepository } from './health.repository';
import { HealthService } from './health.service';

describe('HealthService.report', () => {
  let service: HealthService;
  let repoMock: { pingDb: jest.Mock };
  let redisPingMock: jest.Mock;

  beforeEach(async () => {
    repoMock = { pingDb: jest.fn() };
    redisPingMock = jest.fn();

    const module = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: HealthRepository, useValue: repoMock },
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => 'redis://localhost:6379' },
        },
      ],
    }).compile();

    service = module.get(HealthService);
    (service as unknown as { redis: { ping: jest.Mock; quit: jest.Mock } }).redis = {
      ping: redisPingMock,
      quit: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('todos checks ok -> status ok', async () => {
    repoMock.pingDb.mockResolvedValue(undefined);
    redisPingMock.mockResolvedValue('PONG');

    const report = await service.report();
    expect(report.status).toBe('ok');
    expect(report.checks.db.status).toBe('ok');
    expect(report.checks.redis.status).toBe('ok');
    expect(typeof report.checks.db.latencyMs).toBe('number');
    expect(typeof report.uptime).toBe('number');
  });

  it('db down -> status degraded + checks.db.status down', async () => {
    repoMock.pingDb.mockRejectedValue(new Error('connection refused'));
    redisPingMock.mockResolvedValue('PONG');

    const report = await service.report();
    expect(report.status).toBe('degraded');
    expect(report.checks.db.status).toBe('down');
    expect(report.checks.db.error).toContain('connection refused');
    expect(report.checks.redis.status).toBe('ok');
  });

  it('redis down -> status degraded + checks.redis.status down', async () => {
    repoMock.pingDb.mockResolvedValue(undefined);
    redisPingMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const report = await service.report();
    expect(report.status).toBe('degraded');
    expect(report.checks.redis.status).toBe('down');
    expect(report.checks.db.status).toBe('ok');
  });
});
