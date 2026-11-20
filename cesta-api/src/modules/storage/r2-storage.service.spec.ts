import { Logger } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { R2StorageService } from './r2-storage.service';

jest.mock('@aws-sdk/client-s3', () => {
  const mSend = jest.fn();
  class MockS3Client {
    send = mSend;
  }
  return {
    S3Client: MockS3Client,
    PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
    __mSend: mSend,
  };
});

// pega handle do mock send
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { __mSend: mockedSend } = require('@aws-sdk/client-s3') as unknown as {
  __mSend: jest.Mock;
};

const ENV_SNAPSHOT: Record<string, string | undefined> = {
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_BUCKET: process.env.R2_BUCKET,
  R2_S3_ENDPOINT: process.env.R2_S3_ENDPOINT,
  R2_PUBLIC_BASE_URL: process.env.R2_PUBLIC_BASE_URL,
};

function setValidEnv(): void {
  process.env.R2_ACCOUNT_ID = 'acct123';
  process.env.R2_ACCESS_KEY_ID = 'ak';
  process.env.R2_SECRET_ACCESS_KEY = 'sk';
  process.env.R2_BUCKET = 'cesta-products';
  process.env.R2_PUBLIC_BASE_URL = 'https://pub-123.r2.dev';
  delete process.env.R2_S3_ENDPOINT;
}

describe('R2StorageService', () => {
  beforeEach(() => {
    mockedSend.mockReset();
    setValidEnv();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(ENV_SNAPSHOT)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    jest.restoreAllMocks();
  });

  it('constructor lança STORAGE.MISSING_CONFIG quando env faltante', () => {
    delete process.env.R2_BUCKET;
    expect(() => new R2StorageService()).toThrow(
      /R2 env vars ausentes.*R2_BUCKET/,
    );
  });

  it('uploadImage chama PutObjectCommand com key, contentType, cache-control', async () => {
    mockedSend.mockResolvedValue({});
    const svc = new R2StorageService();
    const result = await svc.uploadImage({
      productId: 'p1',
      bytes: Buffer.from([1, 2, 3]),
      contentType: 'image/webp',
      extension: 'webp',
    });
    expect(result).toEqual({
      key: 'products/p1.webp',
      url: 'https://pub-123.r2.dev/products/p1.webp',
    });
    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: 'cesta-products',
        Key: 'products/p1.webp',
        Body: expect.any(Buffer),
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  });

  it('uploadImage lança STORAGE.UPLOAD_FAIL em erro S3', async () => {
    mockedSend.mockRejectedValue(new Error('NoSuchBucket'));
    const svc = new R2StorageService();
    await expect(
      svc.uploadImage({
        productId: 'p1',
        bytes: Buffer.from([1]),
        contentType: 'image/jpeg',
        extension: 'jpg',
      }),
    ).rejects.toMatchObject({ errorCode: 'STORAGE.UPLOAD_FAIL' });
  });

  it('getPublicUrl concatena base + key normalizado', () => {
    const svc = new R2StorageService();
    expect(svc.getPublicUrl('products/p1.jpg')).toBe(
      'https://pub-123.r2.dev/products/p1.jpg',
    );
    expect(svc.getPublicUrl('/products/p2.jpg')).toBe(
      'https://pub-123.r2.dev/products/p2.jpg',
    );
  });

  it('isManagedUrl reconhece host do R2 publicBaseUrl', () => {
    const svc = new R2StorageService();
    expect(
      svc.isManagedUrl('https://pub-123.r2.dev/products/p1.jpg'),
    ).toBe(true);
    expect(
      svc.isManagedUrl('https://xyz.public.blob.vercel-storage.com/products/p1.jpg'),
    ).toBe(false);
    expect(svc.isManagedUrl('https://prod-mercadona.imgix.net/x.jpg')).toBe(false);
    expect(svc.isManagedUrl(null)).toBe(false);
    expect(svc.isManagedUrl(undefined)).toBe(false);
    expect(svc.isManagedUrl('not a url')).toBe(false);
  });
});
