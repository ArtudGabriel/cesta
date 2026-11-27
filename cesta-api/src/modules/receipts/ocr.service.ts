import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import sharp from 'sharp';
import { createWorker, type Worker as TesseractWorker } from 'tesseract.js';

/**
 * Sprint 240 (#14 OCR Mercadona lento):
 *
 * Bottleneck identificado por leitura do ReceiptsProcessor.runOcr pre-S240:
 * cada job chamava `createWorker('spa')` (download/boot do modelo espanhol
 * ~5-10MB + warm JS worker, 3-10s) e `worker.terminate()` no finally,
 * forçando reinit no próximo job. Em cima disso, o buffer pré-processado
 * preservava o tamanho original do upload (fotos iPhone 4000x3000 rodavam
 * Tesseract em resolução de câmera, ~2-4x mais lento que necessário pra
 * ticket legível).
 *
 * Fix:
 * - Worker singleton Tesseract (OCR é CPU-bound mas BullMQ `receipts` roda
 *   com concurrency default 1 — serial, sem race). Boot amortizado no 1º
 *   job; jobs subsequentes reutilizam o worker vivo (zero init).
 * - Resize defensivo: imagens > MAX_IMAGE_WIDTH (2000px) são downscaled
 *   com `.resize({ width })` mantendo aspect ratio. Tickets Mercadona
 *   impressos legíveis em 1500-2000px wide; manter 4000px só queima CPU.
 * - OnModuleDestroy termina o worker pra shutdown limpo (Nest lifecycle
 *   dispara em SIGTERM — importante pra Render free tier recycle).
 * - Timings expostos no retorno (preprocess, ocr, init). Caller (processor)
 *   loga pra observabilidade de regressão futura.
 *
 * Se no futuro aumentar concurrency do worker receipts, trocar o singleton
 * por um pool keyed pela concurrency (ou usar PoolManager do tesseract.js).
 */

const MAX_IMAGE_WIDTH = 2000;

export interface OcrResult {
  text: string;
  timings: {
    preprocessMs: number;
    ocrMs: number;
    initMs: number;
    totalMs: number;
    resized: boolean;
  };
}

@Injectable()
export class OcrService implements OnModuleDestroy {
  private readonly logger = new Logger(OcrService.name);
  private workerPromise: Promise<TesseractWorker> | null = null;
  private initDurationMs = 0;

  async extractTextFromImage(imagePath: string): Promise<OcrResult> {
    const totalStart = Date.now();

    const preprocessStart = Date.now();
    const base = sharp(imagePath).rotate().grayscale().normalize();
    const meta = await base.metadata();
    let resized = false;
    if (meta.width && meta.width > MAX_IMAGE_WIDTH) {
      base.resize({ width: MAX_IMAGE_WIDTH });
      resized = true;
    }
    const preprocessed = await base.toBuffer();
    const preprocessMs = Date.now() - preprocessStart;

    const worker = await this.getOrCreateWorker();

    const ocrStart = Date.now();
    const result = await worker.recognize(preprocessed);
    const ocrMs = Date.now() - ocrStart;

    return {
      text: result.data.text ?? '',
      timings: {
        preprocessMs,
        ocrMs,
        initMs: this.initDurationMs,
        totalMs: Date.now() - totalStart,
        resized,
      },
    };
  }

  /**
   * Primeiro chamador paga o custo de boot (~3-10s). Chamadores seguintes
   * recebem o worker vivo. Falhas durante o boot zeram o cache pra permitir
   * nova tentativa; sem isso, uma falha transiente deixaria o worker
   * permanentemente quebrado (workerPromise pending rejected).
   */
  private async getOrCreateWorker(): Promise<TesseractWorker> {
    if (this.workerPromise) return this.workerPromise;
    const initStart = Date.now();
    this.workerPromise = createWorker('spa')
      .then((worker) => {
        this.initDurationMs = Date.now() - initStart;
        this.logger.log(
          `Tesseract worker singleton initialized in ${this.initDurationMs}ms`,
        );
        return worker;
      })
      .catch((err) => {
        this.workerPromise = null;
        throw err;
      });
    return this.workerPromise;
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.workerPromise) return;
    try {
      const worker = await this.workerPromise;
      await worker.terminate();
      this.logger.log('Tesseract worker terminated on module destroy');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Tesseract terminate failed: ${message}`);
    } finally {
      this.workerPromise = null;
    }
  }
}
