import { ConfigService } from '@nestjs/config';
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

  // Service agora é fire-and-forget: a promise interna resolve em microtasks.
  // flush() awaita o próximo tick pra permitir then/catch rodar antes das
  // asserções de log.
  async function flushMicrotasks() {
    await new Promise((resolve) => setImmediate(resolve));
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

  it('config completa → POST síncrono (fire-and-forget) com tags + header secret', () => {
    service = buildService({
      WEB_URL: 'http://web.local',
      REVALIDATE_SECRET: 'top-secret',
    });
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' });

    service.revalidateProducts(['p1', 'p2']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://web.local/api/revalidate');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-revalidate-secret']).toBe('top-secret');
    expect(headers['content-type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({
      tags: ['product:p1', 'product:p2'],
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('webhook ok → logger.debug success', async () => {
    service = buildService({ WEB_URL: 'http://w', REVALIDATE_SECRET: 's' });
    const debugSpy = jest
      .spyOn(service['logger'], 'debug')
      .mockImplementation(() => undefined);
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' });

    service.revalidateProducts(['p1']);
    await flushMicrotasks();

    expect(debugSpy).toHaveBeenCalledTimes(1);
    expect(debugSpy.mock.calls[0][0]).toMatch(/Revalidate OK 1 tags/);
  });

  it('webhook 401 → logger.warn + não throw', async () => {
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
    await flushMicrotasks();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/Revalidate HTTP 401 1 tags/);
  });

  it('fetch throw (network) → logger.warn com reason', async () => {
    service = buildService({ WEB_URL: 'http://w', REVALIDATE_SECRET: 's' });
    const warnSpy = jest
      .spyOn(service['logger'], 'warn')
      .mockImplementation(() => undefined);
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    service.revalidateProducts(['p1']);
    await flushMicrotasks();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(
      /Revalidate failed 1 tags .* ECONNREFUSED/,
    );
  });

  it('AbortError → logger.warn reason "timeout 5000ms"', async () => {
    service = buildService({ WEB_URL: 'http://w', REVALIDATE_SECRET: 's' });
    const warnSpy = jest
      .spyOn(service['logger'], 'warn')
      .mockImplementation(() => undefined);
    const err = new Error('aborted');
    err.name = 'AbortError';
    fetchMock.mockRejectedValueOnce(err);

    service.revalidateProducts(['p1']);
    await flushMicrotasks();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/timeout 5000ms/);
  });
});
