import { Logger } from '@nestjs/common';
import { put } from '@vercel/blob';
import {
  BackfillImagesService,
  isBlobUrl,
} from './backfill-images.service';
import { PrismaService } from '../../database/prisma.service';

jest.mock('@vercel/blob');

const mockedPut = put as jest.MockedFunction<typeof put>;

type Fetch = typeof globalThis.fetch;

function mockFetchSequence(responses: Array<Partial<Response>>): jest.Mock {
  const fn = jest.fn();
  for (const r of responses) fn.mockResolvedValueOnce(r);
  return fn;
}

describe('BackfillImagesService', () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.BLOB_READ_WRITE_TOKEN;

  beforeEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = 'blob_rw_test';
    mockedPut.mockReset();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = originalToken;
    jest.restoreAllMocks();
  });

  function buildService(prisma: Partial<PrismaService>): BackfillImagesService {
    return new BackfillImagesService(prisma as PrismaService);
  }

  describe('isBlobUrl helper', () => {
    it('reconhece host **.public.blob.vercel-storage.com', () => {
      expect(
        isBlobUrl('https://xyz.public.blob.vercel-storage.com/products/p1.jpg'),
      ).toBe(true);
    });

    it('rejeita imgix e outros CDNs de terceiros', () => {
      expect(
        isBlobUrl('https://prod-mercadona.imgix.net/images/88451.jpg'),
      ).toBe(false);
      expect(
        isBlobUrl('https://cdn.carrefour.es/products/x.jpg'),
      ).toBe(false);
    });

    it('rejeita null / undefined / string inválida', () => {
      expect(isBlobUrl(null)).toBe(false);
      expect(isBlobUrl(undefined)).toBe(false);
      expect(isBlobUrl('not a url')).toBe(false);
    });
  });

  it('backfillFromSource: baixa bytes de imgix, upload Blob e atualiza Product.imageUrl', async () => {
    const update = jest.fn().mockResolvedValue({});
    const findUnique = jest.fn().mockResolvedValue({
      id: 'p1',
      imageUrl: null,
      deletedAt: null,
    });
    const prisma = {
      product: { findUnique, update, findMany: jest.fn() },
    } as unknown as PrismaService;

    globalThis.fetch = mockFetchSequence([
      {
        ok: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      } as Partial<Response>,
    ]) as unknown as Fetch;

    mockedPut.mockResolvedValue({
      url: 'https://xyz.public.blob.vercel-storage.com/products/p1.jpg',
      pathname: 'products/p1.jpg',
      contentType: 'image/jpeg',
      contentDisposition: 'inline',
    } as Awaited<ReturnType<typeof put>>);

    const svc = buildService(prisma);
    const result = await svc.backfillFromSource({
      productId: 'p1',
      sourceUrl: 'https://prod-mercadona.imgix.net/images/88451.jpg',
    });

    expect(result).toBe('uploaded');
    expect(mockedPut).toHaveBeenCalledWith(
      'products/p1.jpg',
      expect.any(Buffer),
      expect.objectContaining({
        access: 'public',
        contentType: 'image/jpeg',
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 31_536_000,
      }),
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: {
        imageUrl: 'https://xyz.public.blob.vercel-storage.com/products/p1.jpg',
      },
    });
  });

  it('backfillFromSource: migra imgix passthrough existente → Blob (sobrescreve)', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'p2',
      imageUrl: 'https://prod-mercadona.imgix.net/images/88451.jpg',
      deletedAt: null,
    });
    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      product: { findUnique, update, findMany: jest.fn() },
    } as unknown as PrismaService;

    globalThis.fetch = mockFetchSequence([
      {
        ok: true,
        arrayBuffer: async () => new Uint8Array([5, 5, 5]).buffer,
      } as Partial<Response>,
    ]) as unknown as Fetch;

    mockedPut.mockResolvedValue({
      url: 'https://xyz.public.blob.vercel-storage.com/products/p2.jpg',
      pathname: 'products/p2.jpg',
      contentType: 'image/jpeg',
      contentDisposition: 'inline',
    } as Awaited<ReturnType<typeof put>>);

    const svc = buildService(prisma);
    const result = await svc.backfillFromSource({
      productId: 'p2',
      sourceUrl: 'https://prod-mercadona.imgix.net/images/88451.jpg',
    });

    expect(result).toBe('uploaded');
    expect(update).toHaveBeenCalledWith({
      where: { id: 'p2' },
      data: {
        imageUrl: 'https://xyz.public.blob.vercel-storage.com/products/p2.jpg',
      },
    });
  });

  it('backfillFromSource: skipa quando Product já aponta para Blob (race)', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'p3',
      imageUrl:
        'https://xyz.public.blob.vercel-storage.com/products/p3.jpg',
      deletedAt: null,
    });
    const update = jest.fn();
    const prisma = {
      product: { findUnique, update, findMany: jest.fn() },
    } as unknown as PrismaService;

    const svc = buildService(prisma);
    const result = await svc.backfillFromSource({
      productId: 'p3',
      sourceUrl: 'https://prod-mercadona.imgix.net/images/p3.jpg',
    });

    expect(result).toBe('skipped');
    expect(mockedPut).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('backfillFromSource: skipa quando BLOB_READ_WRITE_TOKEN ausente', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const prisma = {
      product: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    } as unknown as PrismaService;

    const svc = buildService(prisma);
    const result = await svc.backfillFromSource({
      productId: 'px',
      sourceUrl: 'https://any/x.jpg',
    });
    expect(result).toBe('skipped');
  });

  it('scanAndBackfill: resolve EAN via OFF, faz upload e conta stats', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: 'p1', name: 'Leche entera', ean: '8480000181732' },
      { id: 'p2', name: 'Sem EAN', ean: null },
    ]);
    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      product: { findMany, update, findUnique: jest.fn() },
    } as unknown as PrismaService;

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

    mockedPut.mockResolvedValue({
      url: 'https://xyz.public.blob.vercel-storage.com/products/p1.jpg',
      pathname: 'products/p1.jpg',
      contentType: 'image/jpeg',
      contentDisposition: 'inline',
    } as Awaited<ReturnType<typeof put>>);

    const svc = buildService(prisma);
    const stats = await svc.scanAndBackfill(10);

    expect(stats).toEqual({
      scanned: 2,
      uploaded: 1,
      fallback: 1,
      errored: 0,
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: {
        imageUrl: 'https://xyz.public.blob.vercel-storage.com/products/p1.jpg',
      },
    });
  });

  it('scanAndBackfill: lança AppException quando BLOB_READ_WRITE_TOKEN ausente', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const prisma = {
      product: { findMany: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    } as unknown as PrismaService;

    const svc = buildService(prisma);
    await expect(svc.scanAndBackfill(10)).rejects.toMatchObject({
      errorCode: 'BACKFILL_IMAGES.MISSING_BLOB_TOKEN',
    });
  });
});
