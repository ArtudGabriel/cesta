import { isBackfillImagesEnabled } from './is-backfill-enabled';

describe('isBackfillImagesEnabled', () => {
  it.each([
    ['true', true],
    ['TRUE', true],
    ['True', true],
    ['1', true],
    ['  true  ', true],
    ['\ttrue\n', true],
  ])('%s → true', (raw, expected) => {
    expect(isBackfillImagesEnabled(raw)).toBe(expected);
  });

  it.each([
    ['false', false],
    ['FALSE', false],
    ['0', false],
    ['', false],
    [' ', false],
    ['yes', false],
    ['enabled', false],
    [undefined, false],
  ])('%s → false', (raw, expected) => {
    expect(isBackfillImagesEnabled(raw)).toBe(expected);
  });
});
