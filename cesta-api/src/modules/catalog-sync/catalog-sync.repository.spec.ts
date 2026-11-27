/**
 * Sprint 228 G2 (ADR 0037) — linkSupermarketDuplicate.
 *
 * Testa reconciliação canônica cross-mercado por EAN. Boss guards:
 * - Merge = LIGAR, não apagar → só UPDATE canonical_product_id.
 * - Idempotente → re-run com duplicate já linkado = zero mudança.
 * - Filtro ean IS NULL protege canonical de ser rebatizado como duplicate.
 */
import { CatalogSyncRepository } from './catalog-sync.repository';
import type { PrismaService } from '../../database/prisma.service';

describe('CatalogSyncRepository.linkSupermarketDuplicate (Sprint 228 G2)', () => {
  let repo: CatalogSyncRepository;
  let prisma: {
    product: {
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    productPrice: {
      findUnique: jest.Mock;
      delete: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      product: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      productPrice: {
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    repo = new CatalogSyncRepository(prisma as unknown as PrismaService);
  });

  it('acha duplicate (ean=null · mesmo normalizedName · canonicalProductId=null) → UPDATE canonicalProductId', async () => {
    prisma.product.findFirst.mockResolvedValueOnce({ id: 'dup-1' });
    prisma.product.update.mockResolvedValueOnce({ id: 'dup-1' });

    const result = await repo.linkSupermarketDuplicate({
      canonicalId: 'canon-1',
      normalizedName: 'coca-cola-zero-2l',
    });

    expect(result).toEqual({ linked: 1, duplicateId: 'dup-1' });
    expect(prisma.product.findFirst).toHaveBeenCalledWith({
      where: {
        normalizedName: 'coca-cola-zero-2l',
        id: { not: 'canon-1' },
        ean: null,
        canonicalProductId: null,
        deletedAt: null,
      },
      select: { id: true },
    });
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'dup-1' },
      data: { canonicalProductId: 'canon-1' },
    });
  });

  it('nenhum duplicate acha → linked=0, duplicateId=null, nenhum UPDATE', async () => {
    prisma.product.findFirst.mockResolvedValueOnce(null);

    const result = await repo.linkSupermarketDuplicate({
      canonicalId: 'canon-1',
      normalizedName: 'produto-sem-dup',
    });

    expect(result).toEqual({ linked: 0, duplicateId: null });
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('Boss guard: NÃO deleta ProductPrice do duplicate (preserva FKs)', async () => {
    prisma.product.findFirst.mockResolvedValueOnce({ id: 'dup-2' });
    prisma.product.update.mockResolvedValueOnce({ id: 'dup-2' });

    await repo.linkSupermarketDuplicate({
      canonicalId: 'canon-2',
      normalizedName: 'leche-entera-1l',
    });

    expect(prisma.productPrice.delete).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('idempotente: duplicate já linkado (canonicalProductId NOT NULL) é excluído pelo filtro findFirst', async () => {
    // findFirst retorna null porque where inclui canonicalProductId: null.
    // Se o duplicate ja tiver canonicalProductId setado, nao bate.
    prisma.product.findFirst.mockResolvedValueOnce(null);

    const result = await repo.linkSupermarketDuplicate({
      canonicalId: 'canon-3',
      normalizedName: 'already-linked',
    });

    expect(result.linked).toBe(0);
  });

  it('filtro ean=null protege: canonical NUNCA rebatizado como duplicate', async () => {
    // Call findFirst — simulate DB has only canonical (ean populated). findFirst
    // returns null porque `ean: null` no where exclui canonical.
    prisma.product.findFirst.mockResolvedValueOnce(null);
    const result = await repo.linkSupermarketDuplicate({
      canonicalId: 'canon-4',
      normalizedName: 'produto-so-canonical',
    });
    expect(result.linked).toBe(0);
    // Confirma que where incluía ean: null.
    const call = prisma.product.findFirst.mock.calls[0][0];
    expect(call.where.ean).toBeNull();
  });
});
