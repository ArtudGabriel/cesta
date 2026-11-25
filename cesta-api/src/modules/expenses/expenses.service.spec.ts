import { ExpensesRepository } from './expenses.repository';
import { ExpensesService } from './expenses.service';

/**
 * Sprint 162 — topProducts: aggregate receiptItems por productId (ou
 * normalizedName quando produto não vinculado); top N por total desc.
 */
describe('ExpensesService.topProducts (Sprint 162)', () => {
  let service: ExpensesService;
  let repo: { findItemsForTopProducts: jest.Mock };

  beforeEach(() => {
    repo = { findItemsForTopProducts: jest.fn() };
    service = new ExpensesService(
      repo as unknown as ExpensesRepository,
    );
  });

  it('agrupa itens por productId, soma total e quantity, ordena desc', async () => {
    repo.findItemsForTopProducts.mockResolvedValue([
      {
        productId: 'p-leche',
        productName: 'Leche 1L',
        productImageUrl: 'http://img/leche.jpg',
        normalizedName: 'leche',
        total: 1.2,
        quantity: 1,
      },
      {
        productId: 'p-leche',
        productName: 'Leche 1L',
        productImageUrl: 'http://img/leche.jpg',
        normalizedName: 'leche',
        total: 1.2,
        quantity: 1,
      },
      {
        productId: 'p-pan',
        productName: 'Pan',
        productImageUrl: null,
        normalizedName: 'pan',
        total: 3.0,
        quantity: 1,
      },
    ]);

    const result = await service.topProducts('u1', 'month');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      productId: 'p-pan',
      name: 'Pan',
      total: 3,
      quantity: 1,
    });
    expect(result[1]).toMatchObject({
      productId: 'p-leche',
      total: 2.4,
      quantity: 2,
    });
  });

  it('agrupa itens sem productId por normalizedName (fallback OCR sem match)', async () => {
    repo.findItemsForTopProducts.mockResolvedValue([
      {
        productId: null,
        productName: null,
        productImageUrl: null,
        normalizedName: 'yogur griego',
        total: 2.5,
        quantity: 1,
      },
      {
        productId: null,
        productName: null,
        productImageUrl: null,
        normalizedName: 'yogur griego',
        total: 2.5,
        quantity: 1,
      },
    ]);

    const result = await service.topProducts('u1', 'month');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      productId: null,
      name: 'yogur griego',
      total: 5,
      quantity: 2,
    });
  });

  it('respeita limit padrão 5', async () => {
    const items = Array.from({ length: 10 }).map((_, i) => ({
      productId: `p-${i}`,
      productName: `prod ${i}`,
      productImageUrl: null,
      normalizedName: `n-${i}`,
      total: i + 1,
      quantity: 1,
    }));
    repo.findItemsForTopProducts.mockResolvedValue(items);

    const result = await service.topProducts('u1', 'month');
    expect(result).toHaveLength(5);
    expect(result[0].total).toBe(10);
    expect(result[4].total).toBe(6);
  });

  it('período vazio → array vazio', async () => {
    repo.findItemsForTopProducts.mockResolvedValue([]);
    const result = await service.topProducts('u1', 'month');
    expect(result).toEqual([]);
  });
});
