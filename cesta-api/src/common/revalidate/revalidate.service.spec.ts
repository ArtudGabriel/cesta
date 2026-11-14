import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { RevalidateService } from './revalidate.service';

describe('RevalidateService', () => {
  let service: RevalidateService;
  let fetchMock: jest.Mock;

  function buildService(env: Record<string, string | undefined>) {
    const config = {
      get: <T>(key: string): T | undefined => env[key] as T | undefined,
    } as ConfigService;
    return new RevalidateService(config);
  }

  /**
   * Fire-and-forget interno via `void IIFE`. Essa helper deixa o loop async
   * terminar (resolve fetch + delays + logs) antes das asserções.
   */
  async function flushAsync() {
    // Esgota microtasks encadeadas; backoff sleeps usam timers reais aqui
    // (mock por teste individual quando precisa testar 2+ attempts).
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }
  }

  async function flushWithFakeTimers() {
    // Alterna entre liberar microtasks e avançar timers pra passar
    // pelos setTimeouts de backoff (1s + 2s = 3s total entre 3 attempts).
    for (let i = 0; i < 20; i++) {
      await Promise.resolve();
      jest.advanceTimersByTime(1000);
    }
  }

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.useRealTimers();
  });

  it('revalidateProducts com array vazio → não chama fetch', () => {
    service = buildService({ WEB_URL: 'http://w', REVALIDATE_SECRET: 's' });
    service.revalidateProducts([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('WEB_URL ausente → no-op', () => {
    service = buildService({ REVALIDATE_SECRET: 's' });
    service.revalidateProducts(['p1']);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('REVALIDATE_SECRET ausente → no-op', () => {
    service = buildService({ WEB_URL: 'http://w' });
    service.revalidateProducts(['p1']);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('success primeiro attempt → POST com HMAC-SHA256(body, secret) + log debug', async () => {
    service = buildService({
      WEB_URL: 'http://web.local',
      REVALIDATE_SECRET: 'top-secret',
    });
    const debugSpy = jest
      .spyOn(service['logger'], 'debug')
      .mockImplementation(() => undefined);
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' });

    service.revalidateProducts(['p1', 'p2']);
    await flushAsync();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://web.local/api/revalidate');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['content-type']).toBe('application/json');
    const expectedBody = JSON.stringify({ tags: ['product:p1', 'product:p2'] });
    const expectedHmac = createHmac('sha256', 'top-secret')
      .update(expectedBody)
      .digest('hex');
    expect(headers['x-revalidate-hmac']).toBe(expectedHmac);
    expect(headers['x-revalidate-secret']).toBeUndefined();
    expect(init.body).toBe(expectedBody);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(debugSpy.mock.calls[0][0]).toMatch(/Revalidate OK 2 tags attempt:1/);
  });

  it('5xx no attempt 1 → retry attempt 2 success', async () => {
    jest.useFakeTimers();
    service = buildService({ WEB_URL: 'http://w', REVALIDATE_SECRET: 's' });
    const warnSpy = jest
      .spyOn(service['logger'], 'warn')
      .mockImplementation(() => undefined);
    const debugSpy = jest
      .spyOn(service['logger'], 'debug')
      .mockImplementation(() => undefined);
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Bad' })
      .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' });

    service.revalidateProducts(['p1']);
    await flushWithFakeTimers();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(warnSpy.mock.calls[0][0]).toMatch(
      /Revalidate HTTP 503 1 tags attempt:1/,
    );
    expect(debugSpy.mock.calls[0][0]).toMatch(
      /Revalidate OK 1 tags attempt:2/,
    );
  });

  it('4xx permanent → sem retry, 1 attempt, warn permanent', async () => {
    service = buildService({ WEB_URL: 'http://w', REVALIDATE_SECRET: 's' });
    const warnSpy = jest
      .spyOn(service['logger'], 'warn')
      .mockImplementation(() => undefined);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    service.revalidateProducts(['p1']);
    await flushAsync();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(
      /Revalidate HTTP 401 1 tags permanent/,
    );
  });

  it('3x timeout → exhausted warning após 3 attempts', async () => {
    jest.useFakeTimers();
    service = buildService({ WEB_URL: 'http://w', REVALIDATE_SECRET: 's' });
    const warnSpy = jest
      .spyOn(service['logger'], 'warn')
      .mockImplementation(() => undefined);
    const err = new Error('aborted');
    err.name = 'AbortError';
    fetchMock.mockRejectedValue(err);

    service.revalidateProducts(['p1']);
    await flushWithFakeTimers();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(warnSpy).toHaveBeenCalled();
    const messages = warnSpy.mock.calls.map((c) => c[0] as string);
    expect(messages.some((m) => /attempt:1.*timeout 5000ms/.test(m))).toBe(true);
    expect(messages.some((m) => /attempt:2.*timeout 5000ms/.test(m))).toBe(true);
    expect(messages.some((m) => /attempt:3.*timeout 5000ms/.test(m))).toBe(true);
    expect(
      messages.some((m) => /exhausted 3 attempts 1 tags/.test(m)),
    ).toBe(true);
  });

  it('network error attempt 1 + success attempt 2 → 2 fetches', async () => {
    jest.useFakeTimers();
    service = buildService({ WEB_URL: 'http://w', REVALIDATE_SECRET: 's' });
    jest
      .spyOn(service['logger'], 'warn')
      .mockImplementation(() => undefined);
    jest
      .spyOn(service['logger'], 'debug')
      .mockImplementation(() => undefined);
    fetchMock
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' });

    service.revalidateProducts(['p1']);
    await flushWithFakeTimers();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
