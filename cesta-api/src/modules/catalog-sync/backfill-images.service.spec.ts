import { Logger } from '@nestjs/common';
import { BackfillImagesService } from './backfill-images.service';
import { BackfillImagesRepository } from './backfill-images.repository';
import type { StorageService } from '../storage/storage.service.interface';

type Fetch = typeof globalThis.fetch;

function mockFetchSequence(responses: Array<Partial<Response>>): jest.Mock {
  const fn = jest.fn();
  for (const r of responses) fn.mockResolvedValueOnce(r);
  return fn;
}

type RepoMock = jest.Mocked<Pick<
  BackfillImagesRepository,
  'findCandidates' | 'findSnapshot' | 'updateImageUrl'
>>;

function buildRepoMock(): RepoMock {
  return {
    findCandidates: jest.fn(),
    findSnapshot: jest.fn(),
    updateImageUrl: jest.fn(),
  };
}

type StorageMock = jest.Mocked<StorageService>;

function buildStorageMock(): StorageMock {
  return {
    uploadImage: jest.fn(),
    getPublicUrl: jest.fn((key) => `https://pub.r2.dev/${key}`),
    isManagedUrl: jest.fn(),
  };
}

describe('BackfillImagesService', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function buildService(
    repo: RepoMock,
    storage: StorageMock,
  ): BackfillImagesService {
    return new BackfillImagesService(
      repo as unknown as BackfillImagesRepository,
      storage,
    );
  }

  it('backfillFromSource: baixa bytes, upload storage e atualiza Product.imageUrl', async () => {
    const repo = buildRepoMock();
    const storage = buildStorageMock();
    repo.findSnapshot.mockResolvedValue({
      id: 'p1',
      imageUrl: null,
      deletedAt: null,
    });
    repo.updateImageUrl.mockResolvedValue();
    storage.isManagedUrl.mockReturnValue(false);
    storage.uploadImage.mockResolvedValue({
      url: 'https://pub.r2.dev/products/p1.jpg',
      key: 'products/p1.jpg',
    });

    globalThis.fetch = mockFetchSequence([
      {
        ok: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      } as Partial<Response>,
    ]) as unknown as Fetch;

    const svc = buildService(repo, storage);
    const result = await svc.backfillFromSource({
      productId: 'p1',
      sourceUrl: 'https://prod-mercadona.imgix.net/images/88451.jpg',
    });

    expect(result).toBe('uploaded');
    expect(storage.uploadImage).toHaveBeenCalledWith({
      productId: 'p1',
      bytes: expect.any(Buffer),
      contentType: 'image/jpeg',
      extension: 'jpg',
    });
    expect(repo.updateImageUrl).toHaveBeenCalledWith(
      'p1',
      'https://pub.r2.dev/products/p1.jpg',
    );
  });

  it('backfillFromSource: migra legacy Blob → R2 quando storage não reconhece', async () => {
    const repo = buildRepoMock();
    const storage = buildStorageMock();
    repo.findSnapshot.mockResolvedValue({
      id: 'p2',
      imageUrl: 'https://xyz.public.blob.vercel-storage.com/products/p2.jpg',
      deletedAt: null,
    });
    repo.updateImageUrl.mockResolvedValue();
    // storage (R2) não reconhece Blob legacy → prossegue com re-upload
    storage.isManagedUrl.mockReturnValue(false);
    storage.uploadImage.mockResolvedValue({
      url: 'https://pub.r2.dev/products/p2.jpg',
      key: 'products/p2.jpg',
    });

    globalThis.fetch = mockFetchSequence([
      {
        ok: true,
        arrayBuffer: async () => new Uint8Array([5, 5, 5]).buffer,
      } as Partial<Response>,
    ]) as unknown as Fetch;

    const svc = buildService(repo, storage);
    const result = await svc.backfillFromSource({
      productId: 'p2',
      sourceUrl: 'https://prod-mercadona.imgix.net/images/p2.jpg',
    });

    expect(result).toBe('uploaded');
    expect(repo.updateImageUrl).toHaveBeenCalledWith(
      'p2',
      'https://pub.r2.dev/products/p2.jpg',
    );
  });

  it('backfillFromSource: skipa quando Product já aponta pro storage gerenciado (race)', async () => {
    const repo = buildRepoMock();
    const storage = buildStorageMock();
    repo.findSnapshot.mockResolvedValue({
      id: 'p3',
      imageUrl: 'https://pub.r2.dev/products/p3.jpg',
      deletedAt: null,
    });
    storage.isManagedUrl.mockReturnValue(true);

    const svc = buildService(repo, storage);
    const result = await svc.backfillFromSource({
      productId: 'p3',
      sourceUrl: 'https://prod-mercadona.imgix.net/images/p3.jpg',
    });

    expect(result).toBe('skipped');
    expect(storage.uploadImage).not.toHaveBeenCalled();
    expect(repo.updateImageUrl).not.toHaveBeenCalled();
  });

  it('scanAndBackfill: resolve EAN via OFF, chama storage e conta stats', async () => {
    const repo = buildRepoMock();
    const storage = buildStorageMock();
    repo.findCandidates.mockResolvedValue([
      { id: 'p1', name: 'Leche entera', ean: '8480000181732' },
      { id: 'p2', name: 'Sem EAN', ean: null },
    ]);
    repo.updateImageUrl.mockResolvedValue();
    storage.isManagedUrl.mockReturnValue(false);
    storage.uploadImage.mockResolvedValue({
      url: 'https://pub.r2.dev/products/p1.jpg',
      key: 'products/p1.jpg',
    });

    globalThis.fetch = mockFetchSequence([
      {
        ok: true,
        json: async () => ({
          status: 1,
          product: { image_front_url: 'https://off.img/front.jpg' },
        }),
      } as Partial<Response>,
      {
        ok: true,
        arrayBuffer: async () => new Uint8Array([9, 9, 9]).buffer,
      } as Partial<Response>,
    ]) as unknown as Fetch;

    const svc = buildService(repo, storage);
    const stats = await svc.scanAndBackfill(10);

    expect(repo.findCandidates).toHaveBeenCalledWith(10);
    expect(stats).toEqual({
      scanned: 2,
      uploaded: 1,
      fallback: 1,
      errored: 0,
    });
    expect(repo.updateImageUrl).toHaveBeenCalledWith(
      'p1',
      'https://pub.r2.dev/products/p1.jpg',
    );
  });

  it('backfillFromSource: errored quando storage.uploadImage throw', async () => {
    const repo = buildRepoMock();
    const storage = buildStorageMock();
    repo.findSnapshot.mockResolvedValue({
      id: 'p9',
      imageUrl: null,
      deletedAt: null,
    });
    storage.isManagedUrl.mockReturnValue(false);
    storage.uploadImage.mockRejectedValue(new Error('r2 403'));

    globalThis.fetch = mockFetchSequence([
      {
        ok: true,
        arrayBuffer: async () => new Uint8Array([1]).buffer,
      } as Partial<Response>,
    ]) as unknown as Fetch;

    const svc = buildService(repo, storage);
    const result = await svc.backfillFromSource({
      productId: 'p9',
      sourceUrl: 'https://any/x.jpg',
    });
    expect(result).toBe('errored');
    expect(repo.updateImageUrl).not.toHaveBeenCalled();
  });
});
