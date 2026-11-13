import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Invalida cache Next.js (RSC `fetch` tags) após mutations server-side.
 * Dev sem WEB_URL/REVALIDATE_SECRET = no-op silencioso. Prod envia POST pro
 * webhook `/api/revalidate` do frontend; falha vira warn mas não derruba sync.
 */
@Injectable()
export class RevalidateService {
  private readonly logger = new Logger(RevalidateService.name);

  constructor(private readonly config: ConfigService) {}

  async revalidateProducts(productIds: string[]): Promise<void> {
    if (productIds.length === 0) return;
    const tags = productIds.map((id) => `product:${id}`);
    await this.revalidateTags(tags);
  }

  async revalidateTags(tags: string[]): Promise<void> {
    if (tags.length === 0) return;
    const webUrl = this.config.get<string>('WEB_URL');
    const secret = this.config.get<string>('REVALIDATE_SECRET');
    if (!webUrl || !secret) return;

    try {
      const res = await fetch(`${webUrl}/api/revalidate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-revalidate-secret': secret,
        },
        body: JSON.stringify({ tags }),
      });
      if (!res.ok) {
        this.logger.warn(
          `Revalidate ${tags.length} tags falhou: ${res.status} ${res.statusText}`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Revalidate ${tags.length} tags erro: ${msg}`);
    }
  }
}
