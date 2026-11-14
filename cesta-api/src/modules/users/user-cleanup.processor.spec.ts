import { Job } from 'bullmq';
import { UserCleanupProcessor, HardDeleteJob } from './user-cleanup.processor';
import { UsersRepository } from './users.repository';

/**
 * Sprint 64: worker user-cleanup GDPR Art.17 safety checks + hard-delete.
 */
describe('UserCleanupProcessor', () => {
  let processor: UserCleanupProcessor;
  let repoMock: {
    findByIdIgnoreDeleted: jest.Mock;
    hardDelete: jest.Mock;
  };

  function fakeJob(data: HardDeleteJob, name = 'hard-delete'): Job<HardDeleteJob> {
    return { name, data } as Job<HardDeleteJob>;
  }

  beforeEach(() => {
    repoMock = {
      findByIdIgnoreDeleted: jest.fn(),
      hardDelete: jest.fn(),
    };
    processor = new UserCleanupProcessor(
      repoMock as unknown as UsersRepository,
    );
    // Silence logger output nos tests.
    jest
      .spyOn(processor['logger'], 'log')
      .mockImplementation(() => undefined);
    jest
      .spyOn(processor['logger'], 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('job.name != hard-delete → ignora silenciosamente', async () => {
    const job = fakeJob({ userId: 'u1' }, 'other');
    await processor.process(job);
    expect(repoMock.findByIdIgnoreDeleted).not.toHaveBeenCalled();
    expect(repoMock.hardDelete).not.toHaveBeenCalled();
  });

  it('user não encontrado → skip idempotente', async () => {
    repoMock.findByIdIgnoreDeleted.mockResolvedValue(null);
    await processor.process(fakeJob({ userId: 'u1' }));
    expect(repoMock.hardDelete).not.toHaveBeenCalled();
  });

  it('user sem deletedAt → aborta (reativação possível)', async () => {
    repoMock.findByIdIgnoreDeleted.mockResolvedValue({
      id: 'u1',
      deletedAt: null,
    });
    await processor.process(fakeJob({ userId: 'u1' }));
    expect(repoMock.hardDelete).not.toHaveBeenCalled();
  });

  it('grace period não elapsed (<30d) → aborta', async () => {
    const now = new Date();
    repoMock.findByIdIgnoreDeleted.mockResolvedValue({
      id: 'u1',
      deletedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10d
    });
    await processor.process(fakeJob({ userId: 'u1' }));
    expect(repoMock.hardDelete).not.toHaveBeenCalled();
  });

  it('grace elapsed + soft-deleted → hard-delete chamado', async () => {
    const now = new Date();
    repoMock.findByIdIgnoreDeleted.mockResolvedValue({
      id: 'u1',
      deletedAt: new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000), // 31d
    });
    await processor.process(fakeJob({ userId: 'u1' }));
    expect(repoMock.hardDelete).toHaveBeenCalledWith('u1');
  });
});
