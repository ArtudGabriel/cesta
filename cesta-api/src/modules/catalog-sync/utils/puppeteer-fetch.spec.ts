// Sprint 129: smoke test pra resolveChromium — garante que import CJS/ESM
// de @sparticuz/chromium-min não retorna undefined em runtime (prod S128
// crashou aqui). Teste NÃO lança Chromium real (dependeria de binary ~300MB
// download CDN GitHub Release); apenas valida que require retorna objeto
// com `executablePath` função e `args` array.

jest.mock('puppeteer-core', () => ({
  __esModule: true,
  default: { launch: jest.fn() },
  launch: jest.fn(),
}));

describe('puppeteer-fetch runtime CJS resolve', () => {
  it('@sparticuz/chromium-min expõe executablePath + args via require', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const raw = require('@sparticuz/chromium-min') as unknown;
    const resolved = raw as {
      executablePath?: unknown;
      args?: unknown;
      default?: { executablePath?: unknown; args?: unknown };
    };

    // Em CJS puro (module.exports = Chromium), raw IS a classe → tem static
    // executablePath + args. Em ESM wrap (.default = Chromium), precisamos
    // unwrap. Ambos aceitos.
    const api =
      typeof resolved.executablePath === 'function'
        ? resolved
        : resolved.default;

    expect(api).toBeDefined();
    expect(typeof api?.executablePath).toBe('function');
    expect(Array.isArray(api?.args)).toBe(true);
  });

  it('puppeteerFetch + closePuppeteerBrowser são exports válidos', async () => {
    const mod = await import('./puppeteer-fetch');
    expect(typeof mod.puppeteerFetch).toBe('function');
    expect(typeof mod.closePuppeteerBrowser).toBe('function');
  });

  it('closePuppeteerBrowser é no-op quando browser nunca foi inicializado', async () => {
    const { closePuppeteerBrowser } = await import('./puppeteer-fetch');
    // Primeira chamada sem launch anterior: deve resolver sem throw.
    await expect(closePuppeteerBrowser()).resolves.toBeUndefined();
  });
});
