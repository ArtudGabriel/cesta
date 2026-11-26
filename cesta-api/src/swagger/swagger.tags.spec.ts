import 'reflect-metadata';

// Sprint 206 — ReceiptsController transitively importa @nestjs/bullmq (ESM).
// Mock pra evitar Jest parse error sem bootar queue infra. Mesmo motivo
// pra bullmq runtime (Queue).
jest.mock('@nestjs/bullmq', () => ({
  InjectQueue: () => () => undefined,
  BullModule: { registerQueue: () => ({}), forRoot: () => ({}) },
}));
jest.mock('bullmq', () => ({ Queue: class {} }));

// @nestjs/swagger API_TAGS key: `${DECORATORS_PREFIX}/apiUseTags`.
// Hardcoded pra evitar deep import que vira ambíguo quando subpath exports
// filtram /dist/* nas versões novas do pacote.
const API_TAGS_METADATA = 'swagger/apiUseTags';
import { AlertsController } from '../modules/alerts/alerts.controller';
import { ExpensesController } from '../modules/expenses/expenses.controller';
import { FavoritesController } from '../modules/favorites/favorites.controller';
import { ReceiptsController } from '../modules/receipts/receipts.controller';
import { ReviewsController } from '../modules/reviews/reviews.controller';
import { ShoppingListsController } from '../modules/shopping-lists/shopping-lists.controller';

/**
 * Sprint 206 — expand swagger.tags valida 3 controllers novos
 * (alerts/receipts/expenses) via metadata reflection. ADR 0021 tracking:
 * 7 → 10 controllers covered.
 */

function getTags(ctor: Function): string[] | undefined {
  return Reflect.getMetadata(API_TAGS_METADATA, ctor);
}

describe('Swagger @ApiTags coverage (S205 rollout)', () => {
  it('ReviewsController declara tag "Reviews"', () => {
    expect(getTags(ReviewsController)).toContain('Reviews');
  });

  it('FavoritesController declara tag "Favorites"', () => {
    expect(getTags(FavoritesController)).toContain('Favorites');
  });

  it('ShoppingListsController declara tag "Shopping Lists"', () => {
    expect(getTags(ShoppingListsController)).toContain('Shopping Lists');
  });
});

describe('Swagger @ApiTags coverage (S206 rollout)', () => {
  it('AlertsController declara tag "Alerts"', () => {
    expect(getTags(AlertsController)).toContain('Alerts');
  });

  it('ReceiptsController declara tag "Receipts"', () => {
    expect(getTags(ReceiptsController)).toContain('Receipts');
  });

  it('ExpensesController declara tag "Expenses"', () => {
    expect(getTags(ExpensesController)).toContain('Expenses');
  });
});
