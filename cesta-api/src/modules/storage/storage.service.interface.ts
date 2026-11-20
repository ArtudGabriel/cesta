/**
 * Sprint 135: abstração storage para desacoplar código de adapter Vercel
 * Blob (ADR 0008) ↔ Cloudflare R2 (ADR 0010). Consumers injetam este
 * token e não referenciam SDK específico.
 */
export const STORAGE_SERVICE = 'STORAGE_SERVICE';

export interface UploadImageInput {
  /** Produto (chave estável) — vira parte do blob key `products/{productId}.{ext}`. */
  productId: string;
  bytes: Buffer;
  contentType: string;
  /** Extensão sem ponto (`jpg`, `webp`, `png`). */
  extension: string;
}

export interface UploadImageResult {
  /** URL pública final (CDN R2). */
  url: string;
  /** Chave no bucket (`products/<id>.<ext>`). Útil pra log + idempotência. */
  key: string;
}

export interface StorageService {
  /**
   * Upload de imagem de produto. Idempotente — sobrescreve se já existir.
   * cache-control: immutable 1y via CDN público do R2.
   */
  uploadImage(input: UploadImageInput): Promise<UploadImageResult>;

  /**
   * URL pública estável dado o key. Usado pela migration script quando
   * key é computável sem re-upload (fallback diagnóstico).
   */
  getPublicUrl(key: string): string;

  /**
   * True se a URL já aponta pra storage atual (R2) — evita re-upload em
   * race conditions (backfill + sync paralelos) e no script de migração
   * (idempotente). Retorna false para Blob legacy, imgix, null, inválido.
   */
  isManagedUrl(url: string | null | undefined): boolean;
}
