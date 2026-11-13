import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const REVALIDATE_TIMEOUT_MS = 5000;

/**
 * Invalida cache Next.js (RSC `fetch` tags) após mutations server-side.
 * Dev sem WEB_URL/REVALIDATE_SECRET = no-op silencioso. Prod envia POST pro
 * webhook `/api/revalidate` do frontend em modo fire-and-forget: o caller não
 * espera a resposta (worker catalog-sync não trava se Render cold start demora
 * ~90s). AbortController limita a request a 5s mesmo sem await.
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

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      REVALIDATE_TIMEOUT_MS,
    );
    const started = Date.now();
    const count = tags.length;

    // Fire-and-forget: sem await. Erros são logados mas não propagam.
    fetch(`${webUrl}/api/revalidate`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-revalidate-secret': secret,
      },
      body: JSON.stringify({ tags }),
      signal: controller.signal,
    })
      .then((res) => {
        const elapsed = Date.now() - started;
        if (res.ok) {
          this.logger.debug(`Revalidate OK ${count} tags (${elapsed}ms)`);
        } else {
          this.logger.warn(
            `Revalidate HTTP ${res.status} ${count} tags (${elapsed}ms)`,
          );
        }
      })
      .catch((err: unknown) => {
        const elapsed = Date.now() - started;
        const reason =
          err instanceof Error && err.name === 'AbortError'
            ? `timeout ${REVALIDATE_TIMEOUT_MS}ms`
            : err instanceof Error
              ? err.message
              : String(err);
        this.logger.warn(
          `Revalidate failed ${count} tags (${elapsed}ms): ${reason}`,
        );
      })
      .finally(() => clearTimeout(timer));
  }
}
