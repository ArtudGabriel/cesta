import { isSwaggerEnabled } from './swagger.setup';

describe('swagger.setup isSwaggerEnabled', () => {
  it('SWAGGER_ENABLED=true force-enables em prod', () => {
    expect(
      isSwaggerEnabled({ NODE_ENV: 'production', SWAGGER_ENABLED: 'true' } as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it('SWAGGER_ENABLED=false force-disables em dev', () => {
    expect(
      isSwaggerEnabled({ NODE_ENV: 'development', SWAGGER_ENABLED: 'false' } as NodeJS.ProcessEnv),
    ).toBe(false);
  });

  it('default production → disabled', () => {
    expect(isSwaggerEnabled({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(false);
  });

  it('default development → enabled', () => {
    expect(
      isSwaggerEnabled({ NODE_ENV: 'development' } as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it('default test → enabled (CI run roda spec contra app)', () => {
    expect(isSwaggerEnabled({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)).toBe(true);
  });

  it('empty env → enabled (NODE_ENV undefined != production)', () => {
    expect(isSwaggerEnabled({} as NodeJS.ProcessEnv)).toBe(true);
  });
});
