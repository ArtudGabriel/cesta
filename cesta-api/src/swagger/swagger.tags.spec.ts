import 'reflect-metadata';

// @nestjs/swagger API_TAGS key: `${DECORATORS_PREFIX}/apiUseTags`.
// Hardcoded pra evitar deep import que vira ambíguo quando subpath exports
// filtram /dist/* nas versões novas do pacote.
const API_TAGS_METADATA = 'swagger/apiUseTags';
import { FavoritesController } from '../modules/favorites/favorites.controller';
import { ReviewsController } from '../modules/reviews/reviews.controller';
import { ShoppingListsController } from '../modules/shopping-lists/shopping-lists.controller';

/**
 * Sprint 205 — expand swagger.smoke valida 3 controllers novos via metadata
 * reflection (zero bootstrap AppModule → não requer Prisma/DB). ADR 0021
 * progresso tracking: 4 → 7 controllers covered.
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
