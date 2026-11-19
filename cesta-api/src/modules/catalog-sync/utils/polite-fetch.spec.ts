import {
  politeFetch,
  politeFetchRaw,
  serializeCookieJar,
} from './polite-fetch';

const originalFetch = global.fetch;

function mockResponse(opts: {
  status: number;
  body?: unknown;
  setCookie?: string[];
  retryAfter?: string;
  contentType?: string;
}): Response {
  const headers = new Headers();
  if (opts.retryAfter) headers.set('retry-after', opts.retryAfter);
  if (opts.contentType) headers.set('content-type', opts.contentType);
  else if (opts.body !== undefined) headers.set('content-type', 'application/json');
  // Simula getSetCookie() do undici.
  const headersWithCookie = headers as unknown as {
    getSetCookie?: () => string[];
  };
  if (opts.setCookie) headersWithCookie.getSetCookie = () => opts.setCookie!;
  return {
    ok: opts.status >= 200 && opts.status < 300,
    status: opts.status,
    headers,
    json: async () => opts.body,
    text: async () => (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body ?? '')),
  } as unknown as Response;
}

describe('polite-fetch', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('politeFetch retorna body em 200 direto', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(mockResponse({ status: 200, body: { ok: true } }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await politeFetch<{ ok: boolean }>('https://x.test/', {
      userAgent: 'ua',
      minJitterMs: 0,
      maxJitterMs: 0,
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('politeFetch retry 403 → 200 após backoff', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(mockResponse({ status: 403, retryAfter: '0' }))
      .mockResolvedValueOnce(mockResponse({ status: 200, body: { ok: true } }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await politeFetch<{ ok: boolean }>('https://x.test/', {
      userAgent: 'ua',
      minJitterMs: 0,
      maxJitterMs: 0,
      maxRetries: 5,
      initialBackoffMs: 1,
      minWaitOnBlockMs: 1,
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('politeFetch respeita minWaitOnBlockMs em 403 sem Retry-After', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(mockResponse({ status: 403 }))
      .mockResolvedValueOnce(mockResponse({ status: 200, body: { ok: true } }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const onRetry = jest.fn();

    const start = Date.now();
    const result = await politeFetch<{ ok: boolean }>('https://x.test/', {
      userAgent: 'ua',
      minJitterMs: 0,
      maxJitterMs: 0,
      maxRetries: 5,
      initialBackoffMs: 1,
      minWaitOnBlockMs: 150,
      onRetry,
    });
    const elapsed = Date.now() - start;

    expect(result).toEqual({ ok: true });
    expect(elapsed).toBeGreaterThanOrEqual(140);
    expect(onRetry).toHaveBeenCalledWith(1, 403, 'https://x.test/');
  });

  it('politeFetchRaw extrai Set-Cookie e preserva status', async () => {
    const setCookie = ['ak_bmsc=abc; Path=/', 'bm_sv=xyz; Path=/'];
    const fetchMock = jest.fn().mockResolvedValue(
      mockResponse({
        status: 200,
        body: '<html></html>',
        setCookie,
        contentType: 'text/html',
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await politeFetchRaw<string>('https://x.test/', {
      userAgent: 'ua',
      minJitterMs: 0,
      maxJitterMs: 0,
    });

    expect(result.status).toBe(200);
    expect(result.body).toContain('<html');
    expect(result.setCookie).toEqual(setCookie);
  });

  it('serializeCookieJar monta Cookie header name=value; name=value', () => {
    const cookies = [
      'ak_bmsc=abc123; Path=/; Max-Age=3600',
      'bm_sv=xyz456; Secure; HttpOnly',
      '',
    ];
    expect(serializeCookieJar(cookies)).toBe('ak_bmsc=abc123; bm_sv=xyz456');
  });

  it('politeFetch envia Cookie e Accept customizados', async () => {
    let capturedInit: RequestInit | undefined;
    const fetchMock = jest.fn().mockImplementation((_url: string, init?: RequestInit) => {
      capturedInit = init;
      return Promise.resolve(mockResponse({ status: 200, body: { ok: true } }));
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await politeFetch('https://x.test/', {
      userAgent: 'ua',
      cookie: 'a=1; b=2',
      accept: 'text/html,*/*',
      minJitterMs: 0,
      maxJitterMs: 0,
    });

    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers.Cookie).toBe('a=1; b=2');
    expect(headers.Accept).toBe('text/html,*/*');
  });
});
