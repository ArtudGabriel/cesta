import { Logger } from '@nestjs/common';
import puppeteer, { Browser, LaunchOptions } from 'puppeteer-core';

// Sprint 129 fix: @sparticuz/chromium-min usa `module.exports = Chromium`
// em CJS (plain default), mas .d.ts ESM declara `export default Chromium`.
// Projeto NÃO tem esModuleInterop → TS `import chromium from '...'` compila
// pra `require('...').default`, que é undefined em runtime CJS. Prod S128
// crashou com "Cannot read properties of undefined (reading executablePath)".
//
// Fix: require() dinâmico + unwrap .default se presente. Cobre ambos CJS
// (direct Chromium class) e ESM (.default = Chromium).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const rawChromium = require('@sparticuz/chromium-min') as unknown;
interface ChromiumApi {
  args: string[];
  executablePath(input?: string): Promise<string>;
}
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
const chromium = resolveChromium(rawChromium);

/**
 * Sprint 128: Puppeteer fetch helper para bypass anti-bot (Akamai, AWS WAF,
 * reCAPTCHA). Launches headless Chromium (via @sparticuz/chromium-min remote
 * binary em Render; local executable via PUPPETEER_EXECUTABLE_PATH em dev).
 *
 * **Render free tier (512MB) memory constraints**:
 * - Chromium process ~200MB resident
 * - Node heap ~150MB após compile
 * - Margem apertada → NÃO rodar paralelo (concurrency=1)
 * - close browser após cada run do adapter (não persistir)
 * - Flags --single-process --no-sandbox --disable-dev-shm-usage p/ limitar RAM
 *
 * @sparticuz/chromium-min: pacote pequeno (~1MB). Baixa binary em runtime de
 * CDN GitHub Release quando `chromium.executablePath(url)` é chamado. Evita
 * inflar build de Render (que tem storage limit).
 */

const logger = new Logger('PuppeteerFetch');
const CHROMIUM_PACK_URL =
  process.env.CHROMIUM_PACK_URL ??
  'https://github.com/Sparticuz/chromium/releases/download/v147.0.0/chromium-v147.0.0-pack.x64.tar';

export interface PuppeteerFetchOptions {
  /** Timeout de navegação em ms (default 30s). */
  timeoutMs?: number;
  /** User-Agent override. */
  userAgent?: string;
  /** Seletor opcional que precisa existir antes de extrair HTML. */
  waitForSelector?: string;
  /** Delay adicional (ms) após load antes de extrair (hydration client-side). */
  extraWaitMs?: number;
  /** Viewport override. */
  viewport?: { width: number; height: number };
}

export interface PuppeteerFetchResult {
  html: string;
  finalUrl: string;
  status: number | null;
}

let browserPromise: Promise<Browser> | null = null;

/**
 * Lazy singleton launcher. Browser lives across calls inside a single adapter
 * run (reused for N pages). Caller MUST call `closePuppeteerBrowser()` no
 * finally do run pra liberar memória — adapter run inteiro deve tratar como
 * acquire/release.
 */
async function getBrowser(): Promise<Browser> {
  if (browserPromise) return browserPromise;

  browserPromise = (async () => {
    const executablePath =
      process.env.PUPPETEER_EXECUTABLE_PATH ??
      (await chromium.executablePath(CHROMIUM_PACK_URL));

    if (!executablePath) {
      throw new Error(
        `Chromium executablePath vazio (CHROMIUM_PACK_URL=${CHROMIUM_PACK_URL})`,
      );
    }

    const launchOptions: LaunchOptions = {
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote',
      ],
      executablePath,
      headless: true,
      defaultViewport: { width: 1280, height: 800 },
    };

    logger.log(`Launching Chromium (executablePath=${executablePath})`);
    return puppeteer.launch(launchOptions);
  })();

  try {
    return await browserPromise;
  } catch (err) {
    browserPromise = null;
    throw err;
  }
}

/**
 * Fetch URL via headless Chromium. Retorna HTML renderizado após JS execução
 * (bypass Akamai/WAF/reCAPTCHA cookie challenges que executam JS).
 *
 * Caller deve chamar `closePuppeteerBrowser()` no finally do adapter run.
 */
export async function puppeteerFetch(
  url: string,
  options: PuppeteerFetchOptions = {},
): Promise<PuppeteerFetchResult> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    if (options.viewport) {
      await page.setViewport(options.viewport);
    }
    if (options.userAgent) {
      await page.setUserAgent(options.userAgent);
    }
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    });

    const response = await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: options.timeoutMs ?? 30_000,
    });
    const status = response ? response.status() : null;
    const finalUrl = page.url();

    if (options.waitForSelector) {
      await page
        .waitForSelector(options.waitForSelector, { timeout: 10_000 })
        .catch(() => undefined);
    }
    if (options.extraWaitMs && options.extraWaitMs > 0) {
      await new Promise((r) => setTimeout(r, options.extraWaitMs));
    }

    const html = await page.content();
    return { html, finalUrl, status };
  } finally {
    await page.close().catch(() => undefined);
  }
}

/**
 * Fecha browser compartilhado. Chamar no finally do adapter.fetchProducts()
 * pra liberar memória antes do próximo job.
 */
export async function closePuppeteerBrowser(): Promise<void> {
  if (!browserPromise) return;
  try {
    const browser = await browserPromise;
    await browser.close();
    logger.log('Chromium browser closed');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`closePuppeteerBrowser falhou: ${msg}`);
  } finally {
    browserPromise = null;
  }
}
