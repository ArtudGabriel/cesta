import { Injectable, Logger } from '@nestjs/common';
import type {
  RawProduct,
  SupermarketAdapter,
} from './supermarket-adapter.interface';

// LIDL Espanha não tem e-commerce de supermercado público com API — folleto
// semanal em PDF é a fonte real de preços. Implementação futura:
//
//  1. Baixar PDF semanal de lidl.es/es/folletos
//  2. Extrair páginas → imagens → OCR com Tesseract (já instalado via receipts)
//  3. Parser específico do layout do folleto LIDL (preços em destaque amarelo)
//  4. Cadastrar com source="folleto_ocr" + confidenceScore 0.75
//
// Temporariamente retorna []. Preços de LIDL serão alimentados por notas
// fiscais escaneadas dos usuários (crowdsourced correction).

@Injectable()
export class LidlAdapter implements SupermarketAdapter {
  readonly slug = 'lidl';
  private readonly logger = new Logger(LidlAdapter.name);

  async fetchProducts(): Promise<RawProduct[]> {
    this.logger.warn(
      'LIDL adapter em stub mode — implementação de folleto OCR pendente',
    );
    return [];
  }
}
