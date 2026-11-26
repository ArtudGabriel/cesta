import { withRetry, AbortError } from './retry';

describe('withRetry (Sprint 189 G2)', () => {
  // Use fake timers so sleeps dont add wall-clock cost; manually advance time.
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('resolve no 1º try sem backoff quando fn passa', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const promise = withRetry(fn);
    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
  });

  it('retry até sucesso dentro do limite', async () => {
    const fn = jest
      .fn<Promise<string>, [number]>()
      .mockRejectedValueOnce(new Error('transient 1'))
      .mockRejectedValueOnce(new Error('transient 2'))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, { backoffMs: [10, 20, 40] });
    // Avança timers em etapas pra pular os sleeps.
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(10);
    await jest.advanceTimersByTimeAsync(20);

    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('propaga erro final após esgotar attempts', async () => {
    const fn = jest
      .fn<Promise<string>, [number]>()
      .mockRejectedValue(new Error('persistent'));

    const promise = withRetry(fn, { attempts: 3, backoffMs: [5, 10] });
    const rejected = expect(promise).rejects.toThrow('persistent');
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(5);
    await jest.advanceTimersByTimeAsync(10);
    await rejected;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('onAttempt callback recebe attempt + error + backoffMs ANTES do sleep', async () => {
    const onAttempt = jest.fn();
    const err1 = new Error('e1');
    const err2 = new Error('e2');
    const fn = jest
      .fn<Promise<string>, [number]>()
      .mockRejectedValueOnce(err1)
      .mockRejectedValueOnce(err2)
      .mockResolvedValueOnce('done');

    const promise = withRetry(fn, {
      attempts: 3,
      backoffMs: [100, 200],
      onAttempt,
    });
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(100);
    await jest.advanceTimersByTimeAsync(200);
    await expect(promise).resolves.toBe('done');

    expect(onAttempt).toHaveBeenCalledTimes(2);
    expect(onAttempt).toHaveBeenNthCalledWith(1, {
      attempt: 1,
      error: err1,
      backoffMs: 100,
    });
    expect(onAttempt).toHaveBeenNthCalledWith(2, {
      attempt: 2,
      error: err2,
      backoffMs: 200,
    });
  });

  it('onAttempt callback erro não derruba retry', async () => {
    const onAttempt = jest.fn().mockRejectedValue(new Error('observability dead'));
    const fn = jest
      .fn<Promise<string>, [number]>()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, {
      attempts: 2,
      backoffMs: [5],
      onAttempt,
    });
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(5);

    await expect(promise).resolves.toBe('ok');
    expect(onAttempt).toHaveBeenCalledTimes(1);
  });

  it('isRetryable=false propaga imediato sem backoff', async () => {
    const fatalErr = new Error('fatal');
    const fn = jest.fn().mockRejectedValue(fatalErr);
    const onAttempt = jest.fn();

    const promise = withRetry(fn, {
      attempts: 5,
      isRetryable: () => false,
      onAttempt,
    });

    await expect(promise).rejects.toBe(fatalErr);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(onAttempt).not.toHaveBeenCalled();
  });

  it('isRetryable discrimina por error code', async () => {
    const fn = jest
      .fn<Promise<string>, [number]>()
      .mockRejectedValueOnce(Object.assign(new Error('P1002'), { code: 'P1002' }))
      .mockRejectedValueOnce(Object.assign(new Error('P4000'), { code: 'P4000' }));

    const promise = withRetry(fn, {
      attempts: 3,
      backoffMs: [5],
      isRetryable: (err) => (err as { code?: string })?.code === 'P1002',
    });
    const assertion = expect(promise).rejects.toThrow('P4000');
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(5);
    await assertion;
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('abort via signal pre-start propaga AbortError imediato', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const fn = jest.fn().mockResolvedValue('never');

    await expect(withRetry(fn, { signal: ctrl.signal })).rejects.toBeInstanceOf(
      AbortError,
    );
    expect(fn).not.toHaveBeenCalled();
  });

  it('abort durante backoff sleep propaga AbortError', async () => {
    const ctrl = new AbortController();
    const fn = jest
      .fn<Promise<string>, [number]>()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce('late');

    const promise = withRetry(fn, {
      attempts: 3,
      backoffMs: [10_000],
      signal: ctrl.signal,
    });
    await Promise.resolve();
    // fn errou, estamos no sleep agora. Aborta mid-sleep.
    ctrl.abort();
    await expect(promise).rejects.toBeInstanceOf(AbortError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('AbortError (classe sentinel) lançado de fn propaga sem retry', async () => {
    const fn = jest
      .fn<Promise<string>, [number]>()
      .mockRejectedValueOnce(new AbortError('caller aborted'));
    const promise = withRetry(fn, { attempts: 5, backoffMs: [5] });
    await expect(promise).rejects.toBeInstanceOf(AbortError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  // Sprint 190: AbortError POR NOME (não da classe sentinel) é retryable.
  // fetch-side timeouts jogam Error com name='AbortError'; caller quer retry.
  it('Error com name="AbortError" (sem instanceof) é retryable', async () => {
    const fetchAbort = new Error('aborted');
    fetchAbort.name = 'AbortError';
    const fn = jest
      .fn<Promise<string>, [number]>()
      .mockRejectedValueOnce(fetchAbort)
      .mockRejectedValueOnce(fetchAbort)
      .mockResolvedValueOnce('late-success');

    const promise = withRetry(fn, { attempts: 3, backoffMs: [5, 10] });
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(5);
    await jest.advanceTimersByTimeAsync(10);
    await expect(promise).resolves.toBe('late-success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('backoff array menor que attempts-1 reusa último valor', async () => {
    const onAttempt = jest.fn();
    const fn = jest
      .fn<Promise<string>, [number]>()
      .mockRejectedValueOnce(new Error('e1'))
      .mockRejectedValueOnce(new Error('e2'))
      .mockRejectedValueOnce(new Error('e3'))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, {
      attempts: 4,
      backoffMs: [10, 20], // só 2 valores pra 3 retries
      onAttempt,
    });
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(10);
    await jest.advanceTimersByTimeAsync(20);
    await jest.advanceTimersByTimeAsync(20); // último reusado

    await expect(promise).resolves.toBe('ok');
    expect(onAttempt.mock.calls.map((c) => c[0].backoffMs)).toEqual([10, 20, 20]);
  });

  it('attempts=1 = zero retries; propaga primeiro erro', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('one-shot'));
    const promise = withRetry(fn, { attempts: 1 });
    await expect(promise).rejects.toThrow('one-shot');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('attempts<1 lança RangeError sync', async () => {
    const fn = jest.fn();
    await expect(withRetry(fn, { attempts: 0 })).rejects.toThrow(RangeError);
    expect(fn).not.toHaveBeenCalled();
  });

  it('attempt number correto é passado pra fn', async () => {
    const seenAttempts: number[] = [];
    const fn = jest.fn(async (n: number) => {
      seenAttempts.push(n);
      if (n < 3) throw new Error(`attempt ${n} fail`);
      return 'ok';
    });
    const promise = withRetry(fn, { attempts: 3, backoffMs: [5] });
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(5);
    await jest.advanceTimersByTimeAsync(5);
    await expect(promise).resolves.toBe('ok');
    expect(seenAttempts).toEqual([1, 2, 3]);
  });
});
