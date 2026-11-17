import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AddBasketItemDto, UpdateBasketItemDto } from './basket-item.dto';

describe('AddBasketItemDto', () => {
  it('productId obrigatório e CUID válido', async () => {
    const dto = plainToInstance(AddBasketItemDto, { productId: 'not-a-cuid' });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'productId')).toBeDefined();
  });

  it('quantity negativa reprova', async () => {
    const dto = plainToInstance(AddBasketItemDto, {
      productId: 'ckxxxxxxxxxxxxxxxxxxxxxxx',
      quantity: -1,
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'quantity')).toBeDefined();
  });

  it('isLocked boolean passa validação', async () => {
    const dto = plainToInstance(AddBasketItemDto, {
      productId: 'ckxxxxxxxxxxxxxxxxxxxxxxx',
      quantity: 2,
      isLocked: true,
    });
    const errors = await validate(dto);
    const bad = errors.filter(
      (e) => e.property !== 'productId' || Object.keys(e.constraints ?? {}).length === 0,
    );
    // só pode falhar productId se não for CUID real; outros campos válidos
    expect(bad.every((e) => e.property === 'productId')).toBe(true);
  });
});

describe('UpdateBasketItemDto', () => {
  it('payload totalmente opcional aceito', async () => {
    const dto = plainToInstance(UpdateBasketItemDto, {});
    const errors = await validate(dto);
    expect(errors).toEqual([]);
  });

  it('quantity < 0.001 reprova', async () => {
    const dto = plainToInstance(UpdateBasketItemDto, { quantity: 0 });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'quantity')).toBeDefined();
  });
});
