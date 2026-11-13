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

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('revalidateProducts com array vazio → não chama fetch', async () => {
    service = buildService({ WEB_URL: 'http://w', REVALIDATE_SECRET: 's' });
    await service.revalidateProducts([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('WEB_URL ausente → no-op', async () => {
    service = buildService({ REVALIDATE_SECRET: 's' });
    await service.revalidateProducts(['p1']);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('REVALIDATE_SECRET ausente → no-op', async () => {
    service = buildService({ WEB_URL: 'http://w' });
    await service.revalidateProducts(['p1']);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('config completa → POST com tags + header secret', async () => {
    service = buildService({
      WEB_URL: 'http://web.local',
      REVALIDATE_SECRET: 'top-secret',
    });
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' });
    await service.revalidateProducts(['p1', 'p2']);
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
  });

  it('webhook 401 → warn silencioso, não throw', async () => {
    service = buildService({ WEB_URL: 'http://w', REVALIDATE_SECRET: 's' });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });
    await expect(service.revalidateProducts(['p1'])).resolves.toBeUndefined();
  });

  it('fetch throw (network) → warn silencioso, não throw', async () => {
    service = buildService({ WEB_URL: 'http://w', REVALIDATE_SECRET: 's' });
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(service.revalidateProducts(['p1'])).resolves.toBeUndefined();
  });
});
