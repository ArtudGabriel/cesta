import { HttpStatus } from '@nestjs/common';
import { Import } from '@prisma/client';
import { Queue } from 'bullmq';
import { AppException } from '../../common/exceptions/app-exception';
import { ImportJob } from './imports.queue';
import { ImportsRepository } from './imports.repository';
import { ImportsService } from './imports.service';

jest.mock('@sentry/node', () => ({ addBreadcrumb: jest.fn() }));

const fakeImport = (overrides: Partial<Import> = {}): Import => ({
  id: 'imp1',
  userId: 'u1',
  status: 'pending',
  dryRun: true,
  zipPath: '/tmp/x.zip',
  summary: null,
  errorMessage: null,
  createdAt: new Date('2026-11-18T10:00:00Z'),
  updatedAt: new Date('2026-11-18T10:00:00Z'),
  ...overrides,
});

describe('ImportsService (S102)', () => {
  let service: ImportsService;
  let repo: {
    create: jest.Mock;
    findByIdForUser: jest.Mock;
    updateStatus: jest.Mock;
  };
  const queue = { add: jest.fn() };

  beforeEach(() => {
    repo = {
      create: jest.fn(),
      findByIdForUser: jest.fn(),
      updateStatus: jest.fn(),
    };
    queue.add.mockReset();
    service = new ImportsService(
      repo as unknown as ImportsRepository,
      queue as unknown as Queue<ImportJob>,
    );
  });

  it('create enqueues parse job and returns dto', async () => {
    repo.create.mockResolvedValue(fakeImport());
    const res = await service.create('u1', '/tmp/x.zip', true);
    expect(res.jobId).toBe('imp1');
    expect(res.status).toBe('pending');
    expect(res.dryRun).toBe(true);
    expect(queue.add).toHaveBeenCalledWith(
      'parse',
      { importId: 'imp1', apply: false },
      expect.objectContaining({ attempts: 1 }),
    );
  });

  it('getStatus 404 if not found', async () => {
    repo.findByIdForUser.mockResolvedValue(null);
    await expect(service.getStatus('u1', 'imp1')).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
    });
  });

  it('getStatus returns dto when owner matches', async () => {
    repo.findByIdForUser.mockResolvedValue(
      fakeImport({ status: 'ready_to_apply', summary: { foo: 1 } as never }),
    );
    const res = await service.getStatus('u1', 'imp1');
    expect(res.status).toBe('ready_to_apply');
    expect(res.summary).toEqual({ foo: 1 });
  });

  it('apply rejects 409 when status != ready_to_apply', async () => {
    repo.findByIdForUser.mockResolvedValue(fakeImport({ status: 'complete' }));
    await expect(service.apply('u1', 'imp1')).rejects.toBeInstanceOf(
      AppException,
    );
    try {
      await service.apply('u1', 'imp1');
    } catch (err) {
      expect((err as AppException).getStatus()).toBe(HttpStatus.CONFLICT);
    }
  });

  it('apply flips to applying and enqueues apply job', async () => {
    repo.findByIdForUser.mockResolvedValue(
      fakeImport({ status: 'ready_to_apply' }),
    );
    repo.updateStatus.mockResolvedValue(
      fakeImport({ status: 'applying' }),
    );
    const res = await service.apply('u1', 'imp1');
    expect(repo.updateStatus).toHaveBeenCalledWith('imp1', 'applying');
    expect(queue.add).toHaveBeenCalledWith(
      'apply',
      { importId: 'imp1', apply: true },
      expect.objectContaining({ attempts: 1 }),
    );
    expect(res.status).toBe('applying');
  });
});
