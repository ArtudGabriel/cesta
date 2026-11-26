import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { withRetry } from '../utils/retry';

const REVALIDATE_TIMEOUT_MS = 5000;
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 1000;
// Sprint 190: backoff array match comportamento prévio (exp 1s/2s). Total 3
// attempts = 2 gaps (entre att1→att2 e att2→att3). Último valor reusado se
// attempts crescerem via options future.
const BACKOFF_MS = [BASE_DELAY_MS, BASE_DELAY_MS * 2];

/** Erro marcador: 4xx response — não deve retry (sentinel pra isRetryable). */
class PermanentHttpError extends Error {
  constructor() {
    super('permanent');
    this.name = 'PermanentHttpError';
  }
}

/**
 * Invalida cache Next.js (RSC `fetch` tags) após mutations server-side.
 * Dev sem WEB_URL/REVALIDATE_SECRET = no-op silencioso. Prod envia POST pro
 * webhook `/api/revalidate` do frontend em modo fire-and-forget: o caller
 * dispara sem await (worker catalog-sync não trava).
 *
 * Sprint 57: body assinado via HMAC-SHA256 pra detectar tampering em trânsito
 * (replace in place do header `x-revalidate-secret` da Sprint 47/48). Retry
 * 3x exp backoff (1s/2s/4s) em 5xx/timeout; 4xx são permanentes (sem retry).
 * Sprint 190: retry delegado ao `withRetry` util (DRY com ADR 0013 + outros).
 */
@Injectable()
export class RevalidateService {
  private readonly logger = new Logger(RevalidateService.name);

  constructor(private readonly config: ConfigService) {}

  revalidateProducts(productIds: string[]): void {
    if (productIds.length === 0) return;
    const tags = productIds.map((id) => `product:${id}`);
    this.revalidateTags(tags);
  }

  revalidateTags(tags: string[]): void {
    if (tags.length === 0) return;
    const webUrl = this.config.get<string>('WEB_URL');
    const secret = this.config.get<string>('REVALIDATE_SECRET');
    if (!webUrl || !secret) return;

    // Fire-and-forget: void IIFE isola o loop async do caller (worker não bloqueia).
    void this.postWithRetry(webUrl, secret, tags);
  }

  private async postWithRetry(
    webUrl: string,
    secret: string,
    tags: string[],
  ): Promise<void> {
    const body = JSON.stringify({ tags });
    const hmac = createHmac('sha256', secret).update(body).digest('hex');
    const count = tags.length;
    const started = Date.now();

    try {
      await withRetry(
        async (attempt) => {
          const controller = new AbortController();
          const timer = setTimeout(
            () => controller.abort(),
            REVALIDATE_TIMEOUT_MS,
          );
          try {
            const res = await fetch(`${webUrl}/api/revalidate`, {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                'x-revalidate-hmac': hmac,
              },
              body,
              signal: controller.signal,
            });
            const elapsed = Date.now() - started;
            if (res.ok) {
              this.logger.debug(
                `Revalidate OK ${count} tags attempt:${attempt} (${elapsed}ms)`,
              );
              return;
            }
            if (res.status >= 400 && res.status < 500) {
              // Permanent — auth/body ruim; retry não resolve.
              this.logger.warn(
                `Revalidate HTTP ${res.status} ${count} tags permanent (${elapsed}ms)`,
              );
              throw new PermanentHttpError();
            }
            this.logger.warn(
              `Revalidate HTTP ${res.status} ${count} tags attempt:${attempt} (${elapsed}ms)`,
            );
            throw new Error(`HTTP ${res.status}`);
          } catch (err: unknown) {
            if (err instanceof PermanentHttpError) throw err;
            const elapsed = Date.now() - started;
            const reason =
              err instanceof Error && err.name === 'AbortError'
                ? `timeout ${REVALIDATE_TIMEOUT_MS}ms`
                : err instanceof Error
                  ? err.message
                  : String(err);
            // Log attempt-level só quando ainda não logado como HTTP response
            // (caminho fetch rejected — timeout ou network). Erros de HTTP
            // status já foram logados acima antes do throw.
            if (!(err instanceof Error && err.message.startsWith('HTTP '))) {
              this.logger.warn(
                `Revalidate failed ${count} tags attempt:${attempt} (${elapsed}ms): ${reason}`,
              );
            }
            throw err;
          } finally {
            clearTimeout(timer);
          }
        },
        {
          attempts: MAX_ATTEMPTS,
          backoffMs: [...BACKOFF_MS],
          isRetryable: (err) => !(err instanceof PermanentHttpError),
        },
      );
    } catch (err) {
      if (err instanceof PermanentHttpError) {
        // Já logamos como "permanent" no fn; não loga exhausted.
        return;
      }
      const total = Date.now() - started;
      this.logger.warn(
        `Revalidate exhausted ${MAX_ATTEMPTS} attempts ${count} tags (${total}ms)`,
      );
    }
  }
}
