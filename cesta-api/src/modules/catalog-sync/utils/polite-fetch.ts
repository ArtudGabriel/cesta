// Fetch wrapper "educado" para evadir rate-limit básico e tornar o scraping
// menos óbvio para bot detectors simples. NÃO vence Akamai/Cloudflare com JS
// challenges — para esses casos, migrar para Puppeteer+stealth (nível 2).
//
// Estratégias combinadas:
//  1. Jitter aleatório entre requests (humaniza o padrão fixo de 2s)
//  2. Headers realistas (Accept-Language, Sec-Fetch-*, Referer)
//  3. Backoff exponencial em 429/403/503 (respeita o servidor)
//  4. Timeout individual (evita adapter travado em request pendurada)
//  5. Pool de User-Agents (reduz fingerprinting de UA único)

export interface PoliteFetchOptions {
  /** User-Agent identificado (obrigatório pra transparência). */
  userAgent: string;
  /** Referer do site alvo. */
  referer?: string;
  /** Max tentativas em erros retryable (429/403/503/5xx/network). */
  maxRetries?: number;
  /** Delay inicial em ms para backoff. */
  initialBackoffMs?: number;
  /** Timeout por request. */
  timeoutMs?: number;
  /** Jitter mínimo antes do request (delay prévio). */
  minJitterMs?: number;
  /** Jitter máximo antes do request. */
  maxJitterMs?: number;
  /** Logger opcional. */
  onRetry?: (attempt: number, status: number | null, url: string) => void;
}

const DEFAULTS = {
  maxRetries: 3,
  initialBackoffMs: 2000,
  timeoutMs: 15_000,
  minJitterMs: 2000,
  maxJitterMs: 5000,
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 403 || status === 503 || status >= 500;
}

function buildHeaders(options: PoliteFetchOptions): HeadersInit {
  return {
    'User-Agent': options.userAgent,
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    ...(options.referer ? { Referer: options.referer } : {}),
  };
}

export async function politeFetch<T = unknown>(
  url: string,
  options: PoliteFetchOptions,
): Promise<T | null> {
  const {
    maxRetries = DEFAULTS.maxRetries,
    initialBackoffMs = DEFAULTS.initialBackoffMs,
    timeoutMs = DEFAULTS.timeoutMs,
    minJitterMs = DEFAULTS.minJitterMs,
    maxJitterMs = DEFAULTS.maxJitterMs,
    onRetry,
  } = options;

  // Jitter prévio — nunca requisita imediatamente
  await sleep(randomInt(minJitterMs, maxJitterMs));

  let attempt = 0;
  let backoff = initialBackoffMs;

  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers: buildHeaders(options),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        return (await response.json()) as T;
      }

      // Respeita Retry-After do servidor quando presente
      if (isRetryableStatus(response.status) && attempt < maxRetries) {
        const retryAfterHeader = response.headers.get('retry-after');
        const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
        const wait =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : backoff + randomInt(0, 1000);
        onRetry?.(attempt + 1, response.status, url);
        await sleep(wait);
        backoff = Math.min(backoff * 2, 30_000);
        attempt += 1;
        continue;
      }

      return null;
    } catch (error) {
      clearTimeout(timeout);
      if (attempt < maxRetries) {
        onRetry?.(attempt + 1, null, url);
        await sleep(backoff + randomInt(0, 1000));
        backoff = Math.min(backoff * 2, 30_000);
        attempt += 1;
        continue;
      }
      throw error;
    }
  }

  return null;
}
