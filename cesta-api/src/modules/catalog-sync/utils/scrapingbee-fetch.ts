import { HttpStatus, Logger } from '@nestjs/common';
import { AppException } from '../../../common/exceptions/app-exception';

// Sprint 134: proxy ScrapingBee para bypass anti-bot (Akamai em Carrefour,
// AWS WAF em Alcampo). Substitui Puppeteer (S128/S130 OOM Render free tier
// 512MB). ADR 0009 opção A.
//
// Preços (credits):
//  - render_js=false              →  1 credit
//  - render_js=true               →  5 credits
//  - render_js=true + premium     → 25 credits
//  - render_js=true + stealth     → 75 credits
//
// Free tier = 1000 credits/mês. Estratégia: tentar render_js primeiro
// (5 credits = ~200 queries/mês). Caller pode escalar pra premium se
// Akamai bloquear.

const BASE_URL = 'https://app.scrapingbee.com/api/v1/';
const DEFAULT_TIMEOUT_MS = 40_000;

const logger = new Logger('ScrapingbeeFetch');

export interface ScrapingbeeFetchOptions {
  /** Timeout request em ms (default 40s). ScrapingBee pode demorar 10-30s. */
  timeoutMs?: number;
  /** Render JavaScript (default true pra SSR/CSR pages). 5 credits/call. */
  renderJs?: boolean;
  /** Proxy residencial premium. 25 credits/call. Escalar se WAF bloquear. */
  premiumProxy?: boolean;
  /** Código país ISO 3166-1 alpha-2 (default es — Carrefour/Alcampo Spain). */
  countryCode?: string;
  /** Selector a esperar antes de retornar HTML (hydration). */
  waitFor?: string;
  /** Delay extra ms após load. */
  wait?: number;
}

export interface ScrapingbeeFetchResult {
  html: string;
  status: number;
  /** Credits gastos no call, extraído de header Spb-Cost. */
  cost: number | null;
}

/**
 * Faz fetch via ScrapingBee. Throw AppException com errorCode namespaced
 * se falhar — chamador decide se marca sync como partial ou failed.
 */
export async function scrapingbeeFetch(
  targetUrl: string,
  options: ScrapingbeeFetchOptions = {},
): Promise<ScrapingbeeFetchResult> {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;
  if (!apiKey) {
    throw new AppException(
      'SCRAPINGBEE.MISSING_API_KEY',
      'SCRAPINGBEE_API_KEY ausente — adapter desabilitado',
      HttpStatus.FAILED_DEPENDENCY,
    );
  }

  const params = new URLSearchParams();
  params.set('api_key', apiKey);
  params.set('url', targetUrl);
  params.set('render_js', options.renderJs !== false ? 'true' : 'false');
  if (options.premiumProxy) params.set('premium_proxy', 'true');
  params.set('country_code', options.countryCode ?? 'es');
  if (options.waitFor) params.set('wait_for', options.waitFor);
  if (options.wait != null) params.set('wait', String(options.wait));

  const requestUrl = `${BASE_URL}?${params.toString()}`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(requestUrl, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new AppException(
        'SCRAPINGBEE.UPSTREAM_FAIL',
        `ScrapingBee retornou ${res.status}: ${body.slice(0, 200)}`,
        HttpStatus.BAD_GATEWAY,
        { status: res.status, url: targetUrl },
      );
    }

    const html = await res.text();
    const costHeader = res.headers.get('spb-cost');
    const cost = costHeader ? Number(costHeader) : null;

    logger.log(
      `fetch ok ${targetUrl} status=${res.status} cost=${cost ?? '?'} bytes=${html.length}`,
    );

    return { html, status: res.status, cost: Number.isFinite(cost) ? cost : null };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof AppException) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new AppException(
      'SCRAPINGBEE.FETCH_FAIL',
      `ScrapingBee fetch falhou: ${message}`,
      HttpStatus.BAD_GATEWAY,
      { url: targetUrl },
    );
  }
}
