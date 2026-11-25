/**
 * Sprint 177 hotfix regression: valida que `sharp` resolve pra função callable
 * via require() + unwrap default (CJS puro em tsconfig sem esModuleInterop).
 *
 * Reproduz runtime real: carrega sharp mesmo jeito que receipts.processor.ts
 * faz, e garante que chamar sharp(bufferOuPath) retorna uma instância
 * encadeável sem crashar com "(0, sharp_1.default) is not a function".
 */
describe('sharp CJS default import unwrap (Sprint 177)', () => {
  it('require("sharp") + default unwrap retorna factory callable', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sharpPkg = require('sharp') as unknown;
    const sharp = (sharpPkg as { default?: unknown }).default ?? sharpPkg;
    expect(typeof sharp).toBe('function');
  });

  it('sharp(buffer) retorna instância com .rotate/.greyscale/.toBuffer chain', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sharpPkg = require('sharp') as unknown;
    const sharp = (
      (sharpPkg as { default?: unknown }).default ?? sharpPkg
    ) as (input?: Buffer | string) => {
      rotate: (angle?: number) => unknown;
      greyscale: () => unknown;
      toBuffer: () => Promise<Buffer>;
    };
    // Buffer PNG mínimo 1x1 pixel (não precisa ser válido — queremos só
    // confirmar que a factory é callable e retorna shape encadeável).
    const png1x1 = Buffer.from(
      '89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D49444154789C62000100000500010D0A2DB40000000049454E44AE426082',
      'hex',
    );
    const instance = sharp(png1x1);
    expect(typeof instance.rotate).toBe('function');
    expect(typeof instance.greyscale).toBe('function');
    expect(typeof instance.toBuffer).toBe('function');
  });
});
