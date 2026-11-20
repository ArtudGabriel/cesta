import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import {
  BackfillImagesJob,
  BackfillImagesProcessor,
} from './backfill-images.processor';
import { BackfillImagesService } from './backfill-images.service';

describe('BackfillImagesProcessor', () => {
  let service: jest.Mocked<Pick<BackfillImagesService, 'scanAndBackfill' | 'backfillFromSource'>>;
  let queue: jest.Mocked<Pick<Queue<BackfillImagesJob>, 'add'>>;
  let processor: BackfillImagesProcessor;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    service = {
      scanAndBackfill: jest.fn(),
      backfillFromSource: jest.fn(),
    };
    queue = { add: jest.fn() };
    processor = new BackfillImagesProcessor(
      service as unknown as BackfillImagesService,
      queue as unknown as Queue<BackfillImagesJob>,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('delega kind=scan-and-backfill → service.scanAndBackfill(limit default)', async () => {
    service.scanAndBackfill.mockResolvedValue({
      scanned: 10,
      uploaded: 7,
      fallback: 2,
      errored: 1,
    });
    const job = { data: { kind: 'scan-and-backfill' } } as Job<BackfillImagesJob>;
    await processor.process(job);
    expect(service.scanAndBackfill).toHaveBeenCalledWith(50);
    expect(service.backfillFromSource).not.toHaveBeenCalled();
  });

  it('delega kind=scan-and-backfill com limit explícito', async () => {
    service.scanAndBackfill.mockResolvedValue({
      scanned: 0,
      uploaded: 0,
      fallback: 0,
      errored: 0,
    });
    const job = {
      data: { kind: 'scan-and-backfill', limit: 200 },
    } as Job<BackfillImagesJob>;
    await processor.process(job);
    expect(service.scanAndBackfill).toHaveBeenCalledWith(200);
  });

  it('delega kind=from-source → service.backfillFromSource(input)', async () => {
    service.backfillFromSource.mockResolvedValue('uploaded');
    const job = {
      data: {
        kind: 'from-source',
        productId: 'p1',
        sourceUrl: 'https://prod-mercadona.imgix.net/images/88451.jpg',
      },
    } as Job<BackfillImagesJob>;
    await processor.process(job);
    expect(service.backfillFromSource).toHaveBeenCalledWith({
      productId: 'p1',
      sourceUrl: 'https://prod-mercadona.imgix.net/images/88451.jpg',
    });
    expect(service.scanAndBackfill).not.toHaveBeenCalled();
  });

  it('propaga erro → BullMQ marca failed', async () => {
    service.backfillFromSource.mockRejectedValue(new Error('boom'));
    const job = {
      data: {
        kind: 'from-source',
        productId: 'p1',
        sourceUrl: 'https://x/y.jpg',
      },
    } as Job<BackfillImagesJob>;
    await expect(processor.process(job)).rejects.toThrow('boom');
  });
});
