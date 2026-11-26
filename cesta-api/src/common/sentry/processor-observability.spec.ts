import { Sentry } from './sentry.init';
import {
  recordJobStart,
  recordJobError,
  isFinalAttempt,
  type JobEventContext,
} from './processor-observability';

jest.mock('./sentry.init', () => ({
  Sentry: {
    addBreadcrumb: jest.fn(),
    captureException: jest.fn(),
    init: jest.fn(),
  },
}));

describe('processor-observability (Sprint 191 G2)', () => {
  const addBreadcrumb = Sentry.addBreadcrumb as jest.Mock;
  const captureException = Sentry.captureException as jest.Mock;

  function makeCtx(overrides: Partial<{
    queueName: string;
    attemptsMade: number;
    maxAttempts: number;
    jobName: string;
    jobId: string;
    data: unknown;
  }> = {}): JobEventContext {
    return {
      queueName: overrides.queueName ?? 'catalog-sync',
      job: {
        id: overrides.jobId ?? 'job-123',
        name: overrides.jobName ?? 'scheduled-sync',
        attemptsMade: overrides.attemptsMade ?? 0,
        data: overrides.data ?? { supermarketSlug: 'mercadona' },
        opts: { attempts: overrides.maxAttempts ?? 3 },
      } as JobEventContext['job'],
    };
  }

  beforeEach(() => {
    addBreadcrumb.mockReset();
    captureException.mockReset();
  });

  describe('isFinalAttempt', () => {
    it('attemptsMade=0, maxAttempts=3 → false', () => {
      expect(isFinalAttempt(makeCtx({ attemptsMade: 0, maxAttempts: 3 }))).toBe(false);
    });

    it('attemptsMade=1, maxAttempts=3 → false', () => {
      expect(isFinalAttempt(makeCtx({ attemptsMade: 1, maxAttempts: 3 }))).toBe(false);
    });

    it('attemptsMade=2, maxAttempts=3 → true (último attempt)', () => {
      expect(isFinalAttempt(makeCtx({ attemptsMade: 2, maxAttempts: 3 }))).toBe(true);
    });

    it('attemptsMade=0, maxAttempts=1 (sem retry) → true', () => {
      expect(isFinalAttempt(makeCtx({ attemptsMade: 0, maxAttempts: 1 }))).toBe(true);
    });

    it('opts.attempts undefined → trata como 1 (final imediato)', () => {
      const ctx: JobEventContext = {
        queueName: 'q',
        job: {
          id: 'x',
          name: 'n',
          attemptsMade: 0,
          data: {},
          opts: {},
        } as JobEventContext['job'],
      };
      expect(isFinalAttempt(ctx)).toBe(true);
    });
  });

  describe('recordJobStart', () => {
    it('emite breadcrumb info com payload completo', () => {
      recordJobStart(makeCtx({ attemptsMade: 0, data: { foo: 'bar' } }));

      expect(addBreadcrumb).toHaveBeenCalledTimes(1);
      const breadcrumb = addBreadcrumb.mock.calls[0][0];
      expect(breadcrumb.category).toBe('bullmq.job');
      expect(breadcrumb.type).toBe('info');
      expect(breadcrumb.level).toBe('info');
      expect(breadcrumb.message).toBe('job start: catalog-sync/scheduled-sync');
      expect(breadcrumb.data).toMatchObject({
        queue: 'catalog-sync',
        jobId: 'job-123',
        name: 'scheduled-sync',
        attemptsMade: 0,
        data: { foo: 'bar' },
      });
      expect(captureException).not.toHaveBeenCalled();
    });

    it('breadcrumb failure não propaga (observability safe)', () => {
      addBreadcrumb.mockImplementationOnce(() => {
        throw new Error('sentry down');
      });
      expect(() => recordJobStart(makeCtx())).not.toThrow();
    });
  });

  describe('recordJobError', () => {
    it('non-final attempt: breadcrumb warning + NÃO chama captureException', () => {
      const err = new Error('transient fetch fail');
      recordJobError(makeCtx({ attemptsMade: 0, maxAttempts: 3 }), err);

      expect(addBreadcrumb).toHaveBeenCalledTimes(1);
      const breadcrumb = addBreadcrumb.mock.calls[0][0];
      expect(breadcrumb.level).toBe('warning');
      expect(breadcrumb.type).toBe('error');
      expect(breadcrumb.message).toBe(
        'job retry scheduled: catalog-sync/scheduled-sync',
      );
      expect(breadcrumb.data).toMatchObject({
        attemptsMade: 0,
        maxAttempts: 3,
        errorMessage: 'transient fetch fail',
      });
      expect(captureException).not.toHaveBeenCalled();
    });

    it('final attempt: breadcrumb error + captureException com tags+extra', () => {
      const err = new Error('persistent');
      recordJobError(
        makeCtx({
          attemptsMade: 2,
          maxAttempts: 3,
          data: { receiptId: 'r1' },
          jobId: 'j-9',
          jobName: 'ocr',
          queueName: 'receipts',
        }),
        err,
      );

      expect(addBreadcrumb).toHaveBeenCalledTimes(1);
      const breadcrumb = addBreadcrumb.mock.calls[0][0];
      expect(breadcrumb.level).toBe('error');
      expect(breadcrumb.message).toBe('job final fail: receipts/ocr');

      expect(captureException).toHaveBeenCalledTimes(1);
      const [captured, context] = captureException.mock.calls[0];
      expect(captured).toBe(err);
      expect(context.tags).toMatchObject({
        queue: 'receipts',
        jobName: 'ocr',
        jobId: 'j-9',
      });
      expect(context.extra).toMatchObject({
        attemptsMade: 2,
        maxAttempts: 3,
        data: { receiptId: 'r1' },
      });
    });

    it('maxAttempts=1 (no retry): primeiro erro = final', () => {
      const err = new Error('no-retry');
      recordJobError(makeCtx({ attemptsMade: 0, maxAttempts: 1 }), err);
      expect(captureException).toHaveBeenCalledTimes(1);
      const breadcrumb = addBreadcrumb.mock.calls[0][0];
      expect(breadcrumb.message).toContain('final fail');
    });

    it('non-Error thrown: converte para string em errorMessage', () => {
      recordJobError(makeCtx(), 'plain string error');
      const breadcrumb = addBreadcrumb.mock.calls[0][0];
      expect(breadcrumb.data.errorMessage).toBe('plain string error');
    });

    it('breadcrumb/captureException failure não propaga', () => {
      addBreadcrumb.mockImplementationOnce(() => {
        throw new Error('sentry down');
      });
      expect(() =>
        recordJobError(makeCtx(), new Error('job fail')),
      ).not.toThrow();
    });
  });
});
