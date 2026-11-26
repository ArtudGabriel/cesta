import { Test } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import type { HealthReport } from './health.service';

describe('HealthController (Sprint 193 G1 /ready alias)', () => {
  let controller: HealthController;
  let healthMock: {
    shallow: jest.Mock;
    report: jest.Mock;
  };

  function mockResponse(): { status: jest.Mock } {
    const status = jest.fn().mockReturnThis();
    return { status };
  }

  beforeEach(async () => {
    healthMock = {
      shallow: jest.fn(),
      report: jest.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: healthMock }],
    }).compile();

    controller = module.get(HealthController);
  });

  it('GET /health → shallow (no I/O)', () => {
    healthMock.shallow.mockReturnValue({
      status: 'ok',
      uptime: 42,
      timestamp: '2026-11-26T15:00:00.000Z',
    });

    const result = controller.shallow();
    expect(result.status).toBe('ok');
    expect(healthMock.shallow).toHaveBeenCalledTimes(1);
    expect(healthMock.report).not.toHaveBeenCalled();
  });

  describe('GET /health/deep', () => {
    it('all ok → 200 + report', async () => {
      const report: HealthReport = {
        status: 'ok',
        uptime: 10,
        timestamp: 't',
        checks: {
          db: { status: 'ok', latencyMs: 5 },
          redis: { status: 'ok', latencyMs: 2 },
        },
      };
      healthMock.report.mockResolvedValue(report);
      const res = mockResponse() as unknown as Response;

      const result = await controller.deep(res);
      expect(result.status).toBe('ok');
      expect(res.status).not.toHaveBeenCalled();
    });

    it('degraded → res.status(503)', async () => {
      healthMock.report.mockResolvedValue({
        status: 'degraded',
        uptime: 1,
        timestamp: 't',
        checks: {
          db: { status: 'down', latencyMs: 5, error: 'err' },
          redis: { status: 'ok', latencyMs: 2 },
        },
      });
      const res = mockResponse() as unknown as Response;

      await controller.deep(res);
      expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    });
  });

  // Sprint 193 (S71 nit): /ready alias K8s/Render readiness probe padrão.
  describe('GET /ready (K8s/Render readiness alias)', () => {
    it('all ok → 200 + report same shape de /health/deep', async () => {
      healthMock.report.mockResolvedValue({
        status: 'ok',
        uptime: 10,
        timestamp: 't',
        checks: {
          db: { status: 'ok', latencyMs: 5 },
          redis: { status: 'ok', latencyMs: 2 },
        },
      });
      const res = mockResponse() as unknown as Response;

      const result = await controller.ready(res);
      expect(result.status).toBe('ok');
      expect(res.status).not.toHaveBeenCalled();
      expect(healthMock.report).toHaveBeenCalledTimes(1);
    });

    it('degraded → res.status(503)', async () => {
      healthMock.report.mockResolvedValue({
        status: 'degraded',
        uptime: 1,
        timestamp: 't',
        checks: {
          db: { status: 'ok', latencyMs: 5 },
          redis: { status: 'down', latencyMs: 3, error: 'ECONNREFUSED' },
        },
      });
      const res = mockResponse() as unknown as Response;

      await controller.ready(res);
      expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    });
  });
});
