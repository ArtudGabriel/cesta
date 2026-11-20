import { Logger } from '@nestjs/common';
import { scrapingbeeFetch } from './scrapingbee-fetch';

type Fetch = typeof globalThis.fetch;

describe('scrapingbeeFetch', () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.SCRAPINGBEE_API_KEY;

  beforeEach(() => {
    process.env.SCRAPINGBEE_API_KEY = 'sb_test_key';
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.SCRAPINGBEE_API_KEY;
    else process.env.SCRAPINGBEE_API_KEY = originalKey;
    jest.restoreAllMocks();
  });

  it('envia api_key + url + render_js=true + country_code=es por default', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '<html>ok</html>',
      headers: { get: (k: string) => (k === 'spb-cost' ? '5' : null) },
    });
    globalThis.fetch = mockFetch as unknown as Fetch;

    const result = await scrapingbeeFetch('https://www.carrefour.es/search?q=leche');
    expect(result.html).toBe('<html>ok</html>');
    expect(result.status).toBe(200);
    expect(result.cost).toBe(5);

    const calledUrl = (mockFetch.mock.calls[0][0] as string);
    expect(calledUrl).toContain('api_key=sb_test_key');
    expect(calledUrl).toContain('url=https%3A%2F%2Fwww.carrefour.es%2Fsearch%3Fq%3Dleche');
    expect(calledUrl).toContain('render_js=true');
    expect(calledUrl).toContain('country_code=es');
    expect(calledUrl).not.toContain('premium_proxy=');
  });

  it('inclui premium_proxy=true quando option passa', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '<ok/>',
      headers: { get: () => '25' },
    });
    globalThis.fetch = mockFetch as unknown as Fetch;

    await scrapingbeeFetch('https://x/y', { premiumProxy: true });
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('premium_proxy=true');
  });

  it('lança AppException SCRAPINGBEE.MISSING_API_KEY quando env ausente', async () => {
    delete process.env.SCRAPINGBEE_API_KEY;
    await expect(
      scrapingbeeFetch('https://x/y'),
    ).rejects.toMatchObject({ errorCode: 'SCRAPINGBEE.MISSING_API_KEY' });
  });

  it('lança SCRAPINGBEE.UPSTREAM_FAIL em status >= 400', async () => {
    globalThis.fetch = (jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'rate limited',
      headers: { get: () => null },
    })) as unknown as Fetch;

    await expect(
      scrapingbeeFetch('https://x/y'),
    ).rejects.toMatchObject({
      errorCode: 'SCRAPINGBEE.UPSTREAM_FAIL',
      meta: { status: 429 },
    });
  });

  it('lança SCRAPINGBEE.FETCH_FAIL quando fetch throw', async () => {
    globalThis.fetch = (jest.fn().mockRejectedValue(new Error('ETIMEDOUT'))) as unknown as Fetch;
    await expect(
      scrapingbeeFetch('https://x/y'),
    ).rejects.toMatchObject({ errorCode: 'SCRAPINGBEE.FETCH_FAIL' });
  });

  it('render_js=false serializa como false', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
      headers: { get: () => '1' },
    });
    globalThis.fetch = mockFetch as unknown as Fetch;
    await scrapingbeeFetch('https://x/y', { renderJs: false });
    expect(mockFetch.mock.calls[0][0]).toContain('render_js=false');
  });
});
