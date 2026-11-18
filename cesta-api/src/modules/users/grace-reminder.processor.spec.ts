import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { GraceReminderProcessor } from './grace-reminder.processor';
import { GraceReminderScanJob } from './grace-reminder.constants';
import { UsersRepository } from './users.repository';

/**
 * Sprint 94: cron grace-reminder — valida janelas 7d/1d, skip de outros dias,
 * idempotência via graceReminderSentAt dedupe window.
 */
describe('GraceReminderProcessor', () => {
  let processor: GraceReminderProcessor;
  let repoMock: {
    findSoftDeletedForGraceReminder: jest.Mock;
    markGraceReminderSent: jest.Mock;
  };
  let emailMock: { sendGraceReminder: jest.Mock };
  let queueMock: { add: jest.Mock };
  let configMock: ConfigService;

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const now = new Date('2026-11-17T09:00:00Z');

  function fakeJob(
    name = 'reminder-scan',
  ): Job<GraceReminderScanJob> {
    return { name, data: {} } as Job<GraceReminderScanJob>;
  }

  function userRow(overrides: Partial<Record<string, unknown>>) {
    return {
      id: 'u1',
      email: 'test@example.com',
      name: 'Test',
      locale: 'es',
      deletedAt: null,
      graceReminderSentAt: null,
      ...overrides,
    } as never;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);

    repoMock = {
      findSoftDeletedForGraceReminder: jest.fn(),
      markGraceReminderSent: jest.fn().mockResolvedValue(undefined),
    };
    emailMock = { sendGraceReminder: jest.fn().mockResolvedValue(undefined) };
    queueMock = { add: jest.fn().mockResolvedValue(undefined) };
    configMock = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'EMAIL_VERIFY_BASE_URL') return 'https://cesta.app';
        if (key === 'CRON_GRACE_REMINDER_HOUR') return 9;
        return fallback;
      }),
    } as unknown as ConfigService;

    const audit = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;
    processor = new GraceReminderProcessor(
      repoMock as unknown as UsersRepository,
      emailMock as unknown as EmailService,
      configMock,
      queueMock as unknown as Queue<GraceReminderScanJob>,
      audit,
    );
    jest
      .spyOn(processor['logger'], 'log')
      .mockImplementation(() => undefined);
    jest
      .spyOn(processor['logger'], 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
  });

  it('user em janela 7d → envia email 7d + marca timestamp', async () => {
    const deletedAt = new Date(now.getTime() - 23 * MS_PER_DAY); // restam 7d
    repoMock.findSoftDeletedForGraceReminder.mockResolvedValue([
      userRow({ deletedAt }),
    ]);

    await processor.process(fakeJob());

    expect(emailMock.sendGraceReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: '7d',
        to: 'test@example.com',
        locale: 'es',
        reactivateUrl: 'https://cesta.app/login',
      }),
    );
    expect(repoMock.markGraceReminderSent).toHaveBeenCalledWith('u1', now);
  });

  it('user em janela 1d + locale pt-BR → envia email 1d PT-BR', async () => {
    const deletedAt = new Date(now.getTime() - 29 * MS_PER_DAY); // restam 1d
    repoMock.findSoftDeletedForGraceReminder.mockResolvedValue([
      userRow({ deletedAt, locale: 'pt-BR' }),
    ]);

    await processor.process(fakeJob());

    expect(emailMock.sendGraceReminder).toHaveBeenCalledWith(
      expect.objectContaining({ stage: '1d', locale: 'pt-BR' }),
    );
  });

  it('user fora das janelas (5d/15d restantes) → skip', async () => {
    const deletedAt15 = new Date(now.getTime() - 15 * MS_PER_DAY);
    const deletedAt5 = new Date(now.getTime() - 25 * MS_PER_DAY);
    repoMock.findSoftDeletedForGraceReminder.mockResolvedValue([
      userRow({ id: 'u15', deletedAt: deletedAt15 }),
      userRow({ id: 'u5', deletedAt: deletedAt5 }),
    ]);

    await processor.process(fakeJob());

    expect(emailMock.sendGraceReminder).not.toHaveBeenCalled();
    expect(repoMock.markGraceReminderSent).not.toHaveBeenCalled();
  });

  it('user em janela 7d mas reminder enviado há 2h → idempotent skip', async () => {
    const deletedAt = new Date(now.getTime() - 23 * MS_PER_DAY);
    const recentlySent = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    repoMock.findSoftDeletedForGraceReminder.mockResolvedValue([
      userRow({ deletedAt, graceReminderSentAt: recentlySent }),
    ]);

    await processor.process(fakeJob());

    expect(emailMock.sendGraceReminder).not.toHaveBeenCalled();
  });

  it('job.name != reminder-scan → noop', async () => {
    await processor.process(fakeJob('other-job'));
    expect(repoMock.findSoftDeletedForGraceReminder).not.toHaveBeenCalled();
  });
});
