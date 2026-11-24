import { Logger } from '@nestjs/common';

// Sprint 138-139: utility for manual local syncs (sync-carrefour +
// sync-alcampo). Prod cron NÃO roda Puppeteer — carrefour+alcampo gated
// por CARREFOUR_ALCAMPO_CRON_ENABLED (default false). Imports lazy via
// dynamic require pra Nest módulo bootar sem Chrome instalado.
//
// Sprint 139: puppeteer-extra + stealth plugin. S138 QA mostrou que
// Akamai (Carrefour) e AWS WAF (Alcampo) ainda detectam headless mesmo
// com Chrome real — stealth patcha navigator.webdriver, plugins, lang,
// chrome.runtime etc. Reduz drasticamente detection rate sem custo.
//
// Local resolve de Chrome:
//  1. `PUPPETEER_EXECUTABLE_PATH` (override explícito — fundamental em
//     Windows onde chromium-min pack `.tar` não resolve)
//  2. `puppeteer` (pacote full, bundled Chrome após
//     `npx puppeteer browsers install chrome`)
//  3. Fallback `@sparticuz/chromium-min` (Lambda Linux only — não
//     funciona em Windows). Mantido pra Render Pro se algum dia subir.

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
  use(plugin: unknown): PuppeteerLike;
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

function tryResolveBundledChrome(): string | null {
  // puppeteer (pacote full) bundle Chrome em ~/.cache/puppeteer.
  // `puppeteer.executablePath()` retorna o path sem baixar nada — se
  // user rodou `npx puppeteer browsers install chrome`, resolve local.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const puppeteerPkg = require('puppeteer') as {
      executablePath?: () => string;
    };
    if (typeof puppeteerPkg.executablePath === 'function') {
      const path = puppeteerPkg.executablePath();
      if (path && path.length > 0) return path;
    }
  } catch (err) {
    logger.warn(
      `puppeteer package não disponível: ${(err as Error).message ?? err}`,
    );
  }
  return null;
}

async function resolveExecutablePath(): Promise<string> {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const bundled = tryResolveBundledChrome();
  if (bundled) return bundled;
  // Último fallback: @sparticuz/chromium-min (Linux x64 only — Lambda).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const rawChromium = require('@sparticuz/chromium-min') as unknown;
  const chromium = resolveChromium(rawChromium);
  const path = await chromium.executablePath(CHROMIUM_PACK_URL);
  if (!path) {
    throw new Error(
      `Chromium executablePath vazio (CHROMIUM_PACK_URL=${CHROMIUM_PACK_URL}). ` +
        `Setar PUPPETEER_EXECUTABLE_PATH OR rodar npx puppeteer browsers install chrome`,
    );
  }
  return path;
}

async function getBrowser(): Promise<BrowserLike> {
  if (browserPromise) return browserPromise;

  browserPromise = (async () => {
    const executablePath = await resolveExecutablePath();

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const puppeteerExtraRaw = require('puppeteer-extra') as unknown;
    const puppeteer =
      (puppeteerExtraRaw as { default?: PuppeteerLike }).default ??
      (puppeteerExtraRaw as PuppeteerLike);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const stealthRaw = require('puppeteer-extra-plugin-stealth') as unknown;
    const stealthFactory =
      (stealthRaw as { default?: () => unknown }).default ??
      (stealthRaw as () => unknown);
    puppeteer.use(stealthFactory());

    const headful = process.env.PUPPETEER_HEADFUL === 'true';
    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ];
    logger.log(
      `Launching Chromium (executablePath=${executablePath}, headful=${headful})`,
    );
    return (await puppeteer.launch({
      args,
      executablePath,
      headless: !headful,
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
