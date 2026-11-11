import { Injectable, Logger } from '@nestjs/common';
import type {
  RawProduct,
  SupermarketAdapter,
} from './supermarket-adapter.interface';

// Aldi Espanha também não expõe preços via API — catálogo semanal em PDF.
// Mesma estratégia do LIDL (OCR do folleto). Stub por enquanto.
//
// TODO:
//  1. Baixar PDF de aldi.es/es/folletos
//  2. OCR com Tesseract
//  3. Parser de layout específico Aldi
//  4. source="folleto_ocr" + confidenceScore 0.75

@Injectable()
export class AldiAdapter implements SupermarketAdapter {
  readonly slug = 'aldi';
  private readonly logger = new Logger(AldiAdapter.name);

  async fetchProducts(): Promise<RawProduct[]> {
    this.logger.warn(
      'Aldi adapter em stub mode — implementação de folleto OCR pendente',
    );
    return [];
  }
}
