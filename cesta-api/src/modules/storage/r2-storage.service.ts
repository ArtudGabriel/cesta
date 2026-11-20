import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { AppException } from '../../common/exceptions/app-exception';
import type {
  StorageService,
  UploadImageInput,
  UploadImageResult,
} from './storage.service.interface';

/**
 * Sprint 135: Cloudflare R2 storage (S3-compatível). Substitui Vercel Blob
 * (ADR 0010) após free tier Blob esgotar (2k writes/mês). R2 free tier
 * = 10 GB + 10 M writes/mês + zero egress.
 */
@Injectable()
export class R2StorageService implements StorageService {
  private readonly logger = new Logger(R2StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor() {
    const {
      R2_ACCOUNT_ID,
      R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY,
      R2_BUCKET,
      R2_S3_ENDPOINT,
      R2_PUBLIC_BASE_URL,
    } = process.env;

    const missing = [
      !R2_ACCESS_KEY_ID && 'R2_ACCESS_KEY_ID',
      !R2_SECRET_ACCESS_KEY && 'R2_SECRET_ACCESS_KEY',
      !R2_BUCKET && 'R2_BUCKET',
      !R2_PUBLIC_BASE_URL && 'R2_PUBLIC_BASE_URL',
      !(R2_ACCOUNT_ID || R2_S3_ENDPOINT) && 'R2_ACCOUNT_ID ou R2_S3_ENDPOINT',
    ].filter(Boolean);
    if (missing.length > 0) {
      throw new AppException(
        'STORAGE.MISSING_CONFIG',
        `R2 env vars ausentes: ${missing.join(', ')}`,
        HttpStatus.FAILED_DEPENDENCY,
      );
    }

    // R2 S3 endpoint canônico: https://<account>.r2.cloudflarestorage.com.
    // R2_S3_ENDPOINT permite override (sandbox / jurisdiction-specific EU).
    const endpoint =
      R2_S3_ENDPOINT ?? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

    this.client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID!,
        secretAccessKey: R2_SECRET_ACCESS_KEY!,
      },
    });
    this.bucket = R2_BUCKET!;
    this.publicBaseUrl = R2_PUBLIC_BASE_URL!.replace(/\/+$/, '');
    this.logger.log(
      `R2 configured: bucket=${this.bucket} endpoint=${endpoint} public=${this.publicBaseUrl}`,
    );
  }

  async uploadImage(input: UploadImageInput): Promise<UploadImageResult> {
    const key = `products/${input.productId}.${input.extension}`;
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: input.bytes,
          ContentType: input.contentType,
          // CDN público do R2 serve com cache-control. Cliente também pode
          // usar immutable 1y por extensão fixa (products/{id}.{ext} nunca
          // muda sem rename de produto).
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new AppException(
        'STORAGE.UPLOAD_FAIL',
        `R2 put falhou: ${msg}`,
        HttpStatus.BAD_GATEWAY,
        { key },
      );
    }
    const url = this.getPublicUrl(key);
    this.logger.log(`upload ok key=${key} url=${url}`);
    return { url, key };
  }

  getPublicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key.replace(/^\/+/, '')}`;
  }

  isManagedUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      const base = new URL(this.publicBaseUrl);
      return parsed.hostname === base.hostname;
    } catch {
      return false;
    }
  }
}
