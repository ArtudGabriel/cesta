import { Logger } from '@nestjs/common';

// Sprint 138: ressucitado para scripts manuais locais (sync-carrefour +
// sync-alcampo). Prod NÃO roda Puppeteer — cron de Carrefour/Alcampo
// está gated por env CARREFOUR_ALCAMPO_CRON_ENABLED (default false).
// Imports são lazy (dynamic require dentro do launch) pra prod Nest
// módulo bootar sem Chromium instalado — bundle carrega o adapter mas
// nunca chama puppeteerFetch.
//
// Local: `npx puppeteer browsers install chrome` baixa Chrome; puppeteer
// (npm) resolve o executable sozinho. Render free-tier não tem Chrome,
// mas também não chama estas rotinas.

const logger = new Logger('PuppeteerFetch');
const CHROMIUM_PACK_URL =
  process.env.CHROMIUM_PACK_URL ??
  'https://github.com/Sparticuz/chromium/releases/download/v147.0.0/chromium-v147.0.0-pack.x64.tar';

export interface PuppeteerFetchOptions {
  timeoutMs?: number;
  userAgent?: string;
  waitForSelector?: string;
  extraWaitMs?: number;
  viewport?: { width: number; height: number };
}

export interface PuppeteerFetchResult {
  html: string;
  finalUrl: string;
  status: number | null;
}

interface ChromiumApi {
  args: string[];
  executablePath(input?: string): Promise<string>;
}

interface PuppeteerLike {
  launch(options: unknown): Promise<unknown>;
}

interface BrowserLike {
  newPage(): Promise<PageLike>;
  close(): Promise<void>;
}

interface PageLike {
  setUserAgent(ua: string): Promise<void>;
  setViewport(v: { width: number; height: number }): Promise<void>;
  setDefaultNavigationTimeout(ms: number): void;
  goto(
    url: string,
    opts: { waitUntil: string; timeout: number },
  ): Promise<{ status(): number } | null>;
  waitForSelector(sel: string, opts: { timeout: number }): Promise<void>;
  evaluate<T>(fn: () => T): Promise<T>;
  content(): Promise<string>;
  url(): string;
  close(): Promise<void>;
}

let browserPromise: Promise<BrowserLike> | null = null;

/**
 * S129 CJS/ESM fix mantido: @sparticuz/chromium-min usa module.exports plain;
 * require() + unwrap .default resolve ambos shapes. tsconfig sem
 * esModuleInterop → import default direto falha em runtime CJS.
 */
function resolveChromium(raw: unknown): ChromiumApi {
  if (raw && typeof (raw as ChromiumApi).executablePath === 'function') {
    return raw as ChromiumApi;
  }
  const withDefault = raw as { default?: ChromiumApi } | null;
  if (
    withDefault?.default &&
    typeof withDefault.default.executablePath === 'function'
  ) {
    return withDefault.default;
  }
  throw new Error(
    `@sparticuz/chromium-min não expõe executablePath (raw=${typeof raw}, default=${typeof withDefault?.default})`,
  );
}

async function getBrowser(): Promise<BrowserLike> {
  if (browserPromise) return browserPromise;

  browserPromise = (async () => {
    // Local dev: PUPPETEER_EXECUTABLE_PATH pode apontar pro Chrome
    // instalado pelo `npx puppeteer browsers install chrome` (default dir
    // `~/.cache/puppeteer/chrome/...`). Produção/CI: chromium-min baixa.
    let executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (!executablePath) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const rawChromium = require('@sparticuz/chromium-min') as unknown;
      const chromium = resolveChromium(rawChromium);
      executablePath = await chromium.executablePath(CHROMIUM_PACK_URL);
    }
    if (!executablePath) {
      throw new Error(
        `Chromium executablePath vazio (CHROMIUM_PACK_URL=${CHROMIUM_PACK_URL})`,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const puppeteer = require('puppeteer-core') as PuppeteerLike;
    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ];
    logger.log(`Launching Chromium (executablePath=${executablePath})`);
    return (await puppeteer.launch({
      args,
      executablePath,
      headless: true,
      defaultViewport: { width: 1280, height: 800 },
    })) as BrowserLike;
  })();

  try {
    return await browserPromise;
  } catch (err) {
    browserPromise = null;
    throw err;
  }
}

export async function closePuppeteerBrowser(): Promise<void> {
  if (!browserPromise) return;
  const current = browserPromise;
  browserPromise = null;
  try {
    const browser = await current;
    await browser.close();
  } catch (err) {
    logger.warn(
      `closePuppeteerBrowser: ${(err as Error).message ?? String(err)}`,
    );
  }
}

export async function puppeteerFetch(
  url: string,
  options: PuppeteerFetchOptions = {},
): Promise<PuppeteerFetchResult> {
  const timeout = options.timeoutMs ?? 30_000;
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    if (options.userAgent) await page.setUserAgent(options.userAgent);
    if (options.viewport) await page.setViewport(options.viewport);
    page.setDefaultNavigationTimeout(timeout);

    const response = await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout,
    });
    const status = response ? response.status() : null;

    if (options.waitForSelector) {
      try {
        await page.waitForSelector(options.waitForSelector, { timeout });
      } catch (err) {
        logger.warn(
          `waitForSelector "${options.waitForSelector}" timeout em ${url}: ${(err as Error).message}`,
        );
      }
    }

    if (options.extraWaitMs && options.extraWaitMs > 0) {
      await new Promise((r) => setTimeout(r, options.extraWaitMs));
    }

    const html = await page.content();
    const finalUrl = page.url();
    return { html, finalUrl, status };
  } finally {
    try {
      await page.close();
    } catch {
      // best-effort
    }
  }
}
