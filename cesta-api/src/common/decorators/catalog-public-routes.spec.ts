import 'reflect-metadata';
import { CategoriesModule } from '../../modules/categories/categories.module';
import { ProductsController } from '../../modules/products/products.controller';
import { SupermarketsController } from '../../modules/supermarkets/supermarkets.controller';
import { ReviewsController } from '../../modules/reviews/reviews.controller';
import { FavoritesController } from '../../modules/favorites/favorites.controller';
import { AlertsController } from '../../modules/alerts/alerts.controller';
import { IS_PUBLIC_KEY } from './public.decorator';

function isPublic(ctor: Function, methodName: string): boolean {
  const handler = ctor.prototype[methodName] as Function | undefined;
  if (!handler) {
    throw new Error(`Handler ${ctor.name}.${methodName} não encontrado`);
  }
  return Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true;
}

// Sprint 72: produtos sem login. Garante que estas 7 rotas GET permanecem
// @Public() — remoção acidental (que reintroduziria login obrigatório pra
// catálogo) quebra o teste.
describe('Catalog public routes (Sprint 72)', () => {
  it('ProductsController: 5 GETs públicos', () => {
    expect(isPublic(ProductsController, 'findMany')).toBe(true);
    expect(isPublic(ProductsController, 'findOne')).toBe(true);
    expect(isPublic(ProductsController, 'suggest')).toBe(true);
    expect(isPublic(ProductsController, 'compare')).toBe(true);
    expect(isPublic(ProductsController, 'priceHistory')).toBe(true);
  });

  it('SupermarketsController: GET list público', () => {
    expect(isPublic(SupermarketsController, 'findAll')).toBe(true);
  });

  it('CategoriesController: GET list público', () => {
    // Controller declarado inline em categories.module.ts; reflect no metadata
    // do módulo via `controllers`.
    const controllers = Reflect.getMetadata(
      'controllers',
      CategoriesModule,
    ) as Function[];
    expect(Array.isArray(controllers) && controllers.length).toBe(1);
    const CategoriesController = controllers[0];
    expect(isPublic(CategoriesController, 'findAll')).toBe(true);
  });
});

// Sprint 72: write endpoints continuam protegidos (zero regressão auth).
describe('Catalog mutation + protected modules stay guarded (Sprint 72)', () => {
  it('ReviewsController: mutations NÃO públicas', () => {
    expect(isPublic(ReviewsController, 'create')).toBe(false);
    expect(isPublic(ReviewsController, 'update')).toBe(false);
    expect(isPublic(ReviewsController, 'remove')).toBe(false);
  });

  it('FavoritesController: handlers NÃO públicos', () => {
    const proto = FavoritesController.prototype as unknown as Record<
      string,
      unknown
    >;
    const methods = Object.getOwnPropertyNames(proto).filter(
      (m) => m !== 'constructor' && typeof proto[m] === 'function',
    );
    expect(methods.length).toBeGreaterThan(0);
    for (const m of methods) {
      expect(isPublic(FavoritesController, m)).toBe(false);
    }
  });

  it('AlertsController: handlers NÃO públicos', () => {
    const proto = AlertsController.prototype as unknown as Record<
      string,
      unknown
    >;
    const methods = Object.getOwnPropertyNames(proto).filter(
      (m) => m !== 'constructor' && typeof proto[m] === 'function',
    );
    expect(methods.length).toBeGreaterThan(0);
    for (const m of methods) {
      expect(isPublic(AlertsController, m)).toBe(false);
    }
  });
});
