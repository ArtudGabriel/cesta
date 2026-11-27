// Sprint 240 (#14) — OcrService singleton + resize coverage.
//
// Mocks tesseract.js e sharp pra evitar download de modelo spa (~5-10MB) e
// isolamento do boot. Foco: provar que `createWorker` é chamado uma única
// vez entre múltiplos `extractTextFromImage` e que resize dispara acima
// de MAX_IMAGE_WIDTH (2000).

const mockRecognize = jest.fn();
const mockTerminate = jest.fn();
const mockCreateWorker = jest.fn();

jest.mock('tesseract.js', () => ({
  createWorker: (...args: unknown[]) => mockCreateWorker(...args),
}));

const sharpInstance = {
  rotate: jest.fn().mockReturnThis(),
  grayscale: jest.fn().mockReturnThis(),
  normalize: jest.fn().mockReturnThis(),
  resize: jest.fn().mockReturnThis(),
  metadata: jest.fn(),
  toBuffer: jest.fn(),
};

jest.mock('sharp', () => ({
  __esModule: true,
  default: jest.fn(() => sharpInstance),
}));

import { OcrService } from './ocr.service';

describe('OcrService (Sprint 240 #14)', () => {
  let service: OcrService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRecognize.mockResolvedValue({ data: { text: 'TICKET MERCADONA' } });
    mockTerminate.mockResolvedValue(undefined);
    mockCreateWorker.mockResolvedValue({
      recognize: mockRecognize,
      terminate: mockTerminate,
    });
    sharpInstance.metadata.mockResolvedValue({ width: 1800 });
    sharpInstance.toBuffer.mockResolvedValue(Buffer.from([0xde, 0xad]));
    service = new OcrService();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('extrai texto chamando recognize no worker + retorna timings', async () => {
    const result = await service.extractTextFromImage('/tmp/receipt1.jpg');
    expect(result.text).toBe('TICKET MERCADONA');
    expect(mockRecognize).toHaveBeenCalledTimes(1);
    expect(result.timings.totalMs).toBeGreaterThanOrEqual(0);
    expect(result.timings.preprocessMs).toBeGreaterThanOrEqual(0);
    expect(result.timings.ocrMs).toBeGreaterThanOrEqual(0);
  });

  it('createWorker chamado UMA vez em múltiplas extrações (singleton)', async () => {
    await service.extractTextFromImage('/tmp/a.jpg');
    await service.extractTextFromImage('/tmp/b.jpg');
    await service.extractTextFromImage('/tmp/c.jpg');
    expect(mockCreateWorker).toHaveBeenCalledTimes(1);
    expect(mockCreateWorker).toHaveBeenCalledWith('spa');
    expect(mockRecognize).toHaveBeenCalledTimes(3);
  });

  it('resize dispara quando width > 2000', async () => {
    sharpInstance.metadata.mockResolvedValue({ width: 4000 });
    const result = await service.extractTextFromImage('/tmp/big.jpg');
    expect(sharpInstance.resize).toHaveBeenCalledWith({ width: 2000 });
    expect(result.timings.resized).toBe(true);
  });

  it('resize NÃO dispara quando width <= 2000', async () => {
    sharpInstance.metadata.mockResolvedValue({ width: 1500 });
    const result = await service.extractTextFromImage('/tmp/small.jpg');
    expect(sharpInstance.resize).not.toHaveBeenCalled();
    expect(result.timings.resized).toBe(false);
  });

  it('resize NÃO dispara quando metadata.width undefined (defensivo)', async () => {
    sharpInstance.metadata.mockResolvedValue({});
    await service.extractTextFromImage('/tmp/weird.jpg');
    expect(sharpInstance.resize).not.toHaveBeenCalled();
  });

  it('falha no primeiro boot zera cache — segundo attempt re-tenta', async () => {
    mockCreateWorker
      .mockRejectedValueOnce(new Error('boot fail'))
      .mockResolvedValueOnce({
        recognize: mockRecognize,
        terminate: mockTerminate,
      });
    await expect(
      service.extractTextFromImage('/tmp/a.jpg'),
    ).rejects.toThrow('boot fail');
    await service.extractTextFromImage('/tmp/b.jpg');
    expect(mockCreateWorker).toHaveBeenCalledTimes(2);
  });

  it('onModuleDestroy termina o worker vivo + zera cache', async () => {
    await service.extractTextFromImage('/tmp/a.jpg');
    await service.onModuleDestroy();
    expect(mockTerminate).toHaveBeenCalledTimes(1);
    // Terminate idempotente — segunda call não erra
    await service.onModuleDestroy();
    expect(mockTerminate).toHaveBeenCalledTimes(1);
  });

  it('onModuleDestroy sem worker inicializado é no-op', async () => {
    await service.onModuleDestroy();
    expect(mockTerminate).not.toHaveBeenCalled();
  });

  it("text vazio é preservado (recognize retorna data.text='')", async () => {
    mockRecognize.mockResolvedValue({ data: { text: '' } });
    const result = await service.extractTextFromImage('/tmp/a.jpg');
    expect(result.text).toBe('');
  });

  it('text ausente retorna string vazia (data.text undefined)', async () => {
    mockRecognize.mockResolvedValue({ data: {} });
    const result = await service.extractTextFromImage('/tmp/a.jpg');
    expect(result.text).toBe('');
  });
});
