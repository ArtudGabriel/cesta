import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import {
  BackfillImagesJob,
  BackfillImagesProcessor,
} from './backfill-images.processor';
import { BackfillImagesService } from './backfill-images.service';

describe('BackfillImagesProcessor', () => {
  let service: jest.Mocked<BackfillImagesService>;
  let queue: jest.Mocked<Queue<BackfillImagesJob>>;
  let processor: BackfillImagesProcessor;

  beforeEach(() => {
    service = {
      scanAndBackfill: jest.fn(),
      backfillFromSource: jest.fn(),
    } as unknown as jest.Mocked<BackfillImagesService>;
    queue = {
      add: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<Queue<BackfillImagesJob>>;
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    processor = new BackfillImagesProcessor(service, queue);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('process scan-and-backfill: chama service.scanAndBackfill com limit do job', async () => {
    service.scanAndBackfill.mockResolvedValue({
      scanned: 50,
      uploaded: 42,
      fallback: 6,
      errored: 2,
    });
    const job = {
      data: { kind: 'scan-and-backfill' as const, limit: 50 },
    } as Job<BackfillImagesJob>;

    await processor.process(job);

    expect(service.scanAndBackfill).toHaveBeenCalledWith(50);
    expect(service.backfillFromSource).not.toHaveBeenCalled();
  });

  it('process from-source: delega ao service.backfillFromSource com productId + sourceUrl', async () => {
    service.backfillFromSource.mockResolvedValue('uploaded');
    const job = {
      data: {
        kind: 'from-source' as const,
        productId: 'p42',
        sourceUrl: 'https://cdn.mercadona.es/42.jpg',
      },
    } as Job<BackfillImagesJob>;

    await processor.process(job);

    expect(service.backfillFromSource).toHaveBeenCalledWith({
      productId: 'p42',
      sourceUrl: 'https://cdn.mercadona.es/42.jpg',
    });
    expect(service.scanAndBackfill).not.toHaveBeenCalled();
  });
});
