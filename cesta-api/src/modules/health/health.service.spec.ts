import { Test } from '@nestjs/testing';
import { HealthRepository } from './health.repository';
import { HealthService } from './health.service';
import { REDIS_HEALTH_CLIENT } from './redis-health.provider';

describe('HealthService.report', () => {
  let service: HealthService;
  let repoMock: { pingDb: jest.Mock };
  let redisMock: { ping: jest.Mock; quit: jest.Mock; on: jest.Mock };

  beforeEach(async () => {
    repoMock = { pingDb: jest.fn() };
    redisMock = {
      ping: jest.fn(),
      quit: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: HealthRepository, useValue: repoMock },
        { provide: REDIS_HEALTH_CLIENT, useValue: redisMock },
      ],
    }).compile();

    service = module.get(HealthService);
  });

  it('todos checks ok -> status ok', async () => {
    repoMock.pingDb.mockResolvedValue(undefined);
    redisMock.ping.mockResolvedValue('PONG');

    const report = await service.report();
    expect(report.status).toBe('ok');
    expect(report.checks.db.status).toBe('ok');
    expect(report.checks.redis.status).toBe('ok');
    expect(typeof report.checks.db.latencyMs).toBe('number');
    expect(typeof report.uptime).toBe('number');
  });

  it('db down -> status degraded + checks.db.status down', async () => {
    repoMock.pingDb.mockRejectedValue(new Error('connection refused'));
    redisMock.ping.mockResolvedValue('PONG');

    const report = await service.report();
    expect(report.status).toBe('degraded');
    expect(report.checks.db.status).toBe('down');
    expect(report.checks.db.error).toContain('connection refused');
    expect(report.checks.redis.status).toBe('ok');
  });

  it('redis down -> status degraded + checks.redis.status down', async () => {
    repoMock.pingDb.mockResolvedValue(undefined);
    redisMock.ping.mockRejectedValue(new Error('ECONNREFUSED'));

    const report = await service.report();
    expect(report.status).toBe('degraded');
    expect(report.checks.redis.status).toBe('down');
    expect(report.checks.db.status).toBe('ok');
  });

  // Sprint 193 (S71 nit close): ambos down → degraded; ambos errors capturados.
  it('both down -> status degraded + db.error + redis.error populados', async () => {
    repoMock.pingDb.mockRejectedValue(new Error('ECONNRESET db'));
    redisMock.ping.mockRejectedValue(new Error('ECONNREFUSED redis'));

    const report = await service.report();
    expect(report.status).toBe('degraded');
    expect(report.checks.db.status).toBe('down');
    expect(report.checks.redis.status).toBe('down');
    expect(report.checks.db.error).toContain('ECONNRESET db');
    expect(report.checks.redis.error).toContain('ECONNREFUSED redis');
  });

});

describe('HealthService.shallow (Sprint 87)', () => {
  let service: HealthService;
  let repoMock: { pingDb: jest.Mock };
  let redisMock: { ping: jest.Mock; quit: jest.Mock; on: jest.Mock };

  beforeEach(async () => {
    repoMock = { pingDb: jest.fn() };
    redisMock = {
      ping: jest.fn(),
      quit: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: HealthRepository, useValue: repoMock },
        { provide: REDIS_HEALTH_CLIENT, useValue: redisMock },
      ],
    }).compile();

    service = module.get(HealthService);
  });

  it('retorna ok sem tocar em DB nem Redis', () => {
    const report = service.shallow();
    expect(report.status).toBe('ok');
    expect(typeof report.uptime).toBe('number');
    expect(typeof report.timestamp).toBe('string');
    expect(repoMock.pingDb).not.toHaveBeenCalled();
    expect(redisMock.ping).not.toHaveBeenCalled();
  });
});
