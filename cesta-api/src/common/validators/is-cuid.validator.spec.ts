import { validate } from 'class-validator';
import { IsCuid } from './is-cuid.validator';
import { AddFavoriteDto } from '../../modules/favorites/dtos/add-favorite.dto';
import { CreateReviewDto } from '../../modules/reviews/dtos/create-review.dto';
import { CreateAlertDto } from '../../modules/alerts/dtos/create-alert.dto';
import { AddItemDto } from '../../modules/shopping-lists/dtos/list-item.dto';
import { AddBasketItemDto } from '../../modules/family-baskets/dtos/basket-item.dto';

class Probe {
  @IsCuid()
  productId!: string;
}

describe('IsCuid validator', () => {
  it('aceita CUID válido', async () => {
    const p = new Probe();
    p.productId = 'cmwcrquei003413n6em4rp09v';
    expect(await validate(p)).toHaveLength(0);
  });

  it('rejeita string arbitrária', async () => {
    const p = new Probe();
    p.productId = 'banana';
    const errors = await validate(p);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.matches).toMatch(/CUID/);
  });

  it('rejeita SQL injection tentativa', async () => {
    const p = new Probe();
    p.productId = "' OR '1'='1";
    expect(await validate(p)).toHaveLength(1);
  });

  it('rejeita CUID curto demais', async () => {
    const p = new Probe();
    p.productId = 'c123';
    expect(await validate(p)).toHaveLength(1);
  });

  it('AddFavoriteDto: cuid válido passa, random falha', async () => {
    const ok = Object.assign(new AddFavoriteDto(), {
      productId: 'cmwcrquei003413n6em4rp09v',
    });
    expect(await validate(ok)).toHaveLength(0);
    const bad = Object.assign(new AddFavoriteDto(), { productId: 'banana' });
    expect(await validate(bad)).toHaveLength(1);
  });

  it('CreateReviewDto.productId exige CUID', async () => {
    const bad = Object.assign(new CreateReviewDto(), {
      productId: 'nope',
      rating: 5,
    });
    const errs = await validate(bad);
    expect(errs.some((e) => e.property === 'productId')).toBe(true);
  });

  it('CreateAlertDto: productId + supermarketId exigem CUID', async () => {
    const bad = Object.assign(new CreateAlertDto(), {
      productId: 'nope',
      supermarketId: 'x',
      type: 'promotion',
    });
    const errs = await validate(bad);
    expect(errs.some((e) => e.property === 'productId')).toBe(true);
    expect(errs.some((e) => e.property === 'supermarketId')).toBe(true);
  });

  it('shopping-lists AddItemDto.productId exige CUID', async () => {
    const bad = Object.assign(new AddItemDto(), { productId: 'nope' });
    const errs = await validate(bad);
    expect(errs.some((e) => e.property === 'productId')).toBe(true);
  });

  it('family-baskets AddBasketItemDto.productId exige CUID', async () => {
    const bad = Object.assign(new AddBasketItemDto(), { productId: 'nope' });
    const errs = await validate(bad);
    expect(errs.some((e) => e.property === 'productId')).toBe(true);
  });
});
