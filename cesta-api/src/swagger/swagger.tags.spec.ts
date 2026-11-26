import 'reflect-metadata';

// Sprint 206 — ReceiptsController transitively importa @nestjs/bullmq (ESM).
// Sprint 207 — CatalogSyncController importa processor → service → alerts
// processor → notifications.service → web-push (ESM). Mock da cadeia.
// Sprint 208 — NotificationsController reexpõe web-push (mock mantido);
// ImportsController depende multer disk storage (lazy, safe). Admin + 2FA
// puxam users.service / audit.service — Prisma init só roda em Module boot,
// ler metadata do controller não toca DB.
jest.mock('@nestjs/bullmq', () => ({
  InjectQueue: () => () => undefined,
  Processor: () => () => undefined,
  WorkerHost: class {},
  BullModule: { registerQueue: () => ({}), forRoot: () => ({}) },
}));
jest.mock('bullmq', () => ({ Queue: class {}, Job: class {} }));
jest.mock('web-push', () => ({
  setVapidDetails: () => undefined,
  sendNotification: async () => ({ statusCode: 201 }),
}));

// @nestjs/swagger API_TAGS key: `${DECORATORS_PREFIX}/apiUseTags`.
// Hardcoded pra evitar deep import que vira ambíguo quando subpath exports
// filtram /dist/* nas versões novas do pacote.
const API_TAGS_METADATA = 'swagger/apiUseTags';
import { AdminController } from '../modules/admin/admin.controller';
import { AlertsController } from '../modules/alerts/alerts.controller';
import { TwoFactorController } from '../modules/auth/two-factor/two-factor.controller';
import { CatalogSyncController } from '../modules/catalog-sync/catalog-sync.controller';
import { ExpensesController } from '../modules/expenses/expenses.controller';
import { FamilyBasketsController } from '../modules/family-baskets/family-baskets.controller';
import { FamilyProfilesController } from '../modules/family-profiles/family-profiles.controller';
import { FavoritesController } from '../modules/favorites/favorites.controller';
import { ImportsController } from '../modules/imports/imports.controller';
import { NotificationsController } from '../modules/notifications/notifications.controller';
import { ReceiptsController } from '../modules/receipts/receipts.controller';
import { ReviewsController } from '../modules/reviews/reviews.controller';
import { ShoppingListsController } from '../modules/shopping-lists/shopping-lists.controller';

/**
 * Sprint 208 — expand swagger.tags valida 4 controllers finais
 * (notifications/imports/admin/two-factor) via metadata reflection.
 * ADR 0021 Closed: 13 → 17 controllers covered.
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

describe('Swagger @ApiTags coverage (S207 rollout)', () => {
  it('FamilyProfilesController declara tag "Family Profiles"', () => {
    expect(getTags(FamilyProfilesController)).toContain('Family Profiles');
  });

  it('FamilyBasketsController declara tag "Family Baskets"', () => {
    expect(getTags(FamilyBasketsController)).toContain('Family Baskets');
  });

  it('CatalogSyncController declara tag "Catalog Sync"', () => {
    expect(getTags(CatalogSyncController)).toContain('Catalog Sync');
  });
});

describe('Swagger @ApiTags coverage (S208 finisher — ADR 0021 Closed 17/17)', () => {
  it('ImportsController declara tag "User CSV Import"', () => {
    expect(getTags(ImportsController)).toContain('User CSV Import');
  });

  it('AdminController declara tag "Admin"', () => {
    expect(getTags(AdminController)).toContain('Admin');
  });

  it('TwoFactorController declara tag "Auth 2FA"', () => {
    expect(getTags(TwoFactorController)).toContain('Auth 2FA');
  });

  it('NotificationsController declara tag "Notifications"', () => {
    expect(getTags(NotificationsController)).toContain('Notifications');
  });
});
