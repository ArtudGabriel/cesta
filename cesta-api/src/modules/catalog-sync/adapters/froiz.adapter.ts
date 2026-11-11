import { Injectable, Logger } from '@nestjs/common';
import type {
  RawProduct,
  SupermarketAdapter,
} from './supermarket-adapter.interface';

// Froiz é rede regional (Galiza) com presença em Madrid. Site froiz.com não
// expõe API pública; adapter futuro faria scraping HTML com Cheerio dos
// catálogos semanais. Por enquanto, stub.
//
// TODO:
//  1. Instalar cheerio e cheerio-select
//  2. Iterar sobre páginas de categoria em froiz.com/supermercado
//  3. Parsear cards de produto (seletor .product-card)
//  4. Respeitar robots.txt e rate-limit 3s+
//
// Enquanto isso, retorna [] — run marca como "failed" (zero items) mas sem
// crashar o sistema; preços de Froiz serão alimentados por notas fiscais
// escaneadas via crowdsourced correction.

@Injectable()
export class FroizAdapter implements SupermarketAdapter {
  readonly slug = 'froiz';
  private readonly logger = new Logger(FroizAdapter.name);

  async fetchProducts(): Promise<RawProduct[]> {
    this.logger.warn(
      'Froiz adapter em stub mode — implementação de scraping HTML pendente',
    );
    return [];
  }
}
