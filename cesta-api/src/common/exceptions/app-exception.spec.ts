import { HttpStatus } from '@nestjs/common';
import { AppException } from './app-exception';

describe('AppException', () => {
  it('serializa errorCode + message + status no response payload', () => {
    const err = new AppException(
      'AUTH.INVALID_CREDENTIALS',
      'Credenciais inválidas',
      HttpStatus.UNAUTHORIZED,
    );
    expect(err.getStatus()).toBe(401);
    const payload = err.getResponse() as Record<string, unknown>;
    expect(payload.errorCode).toBe('AUTH.INVALID_CREDENTIALS');
    expect(payload.message).toBe('Credenciais inválidas');
  });

  it('carrega meta opcional', () => {
    const err = new AppException(
      'ALERTS.NOT_FOUND',
      'Alerta "abc" não encontrado',
      HttpStatus.NOT_FOUND,
      { alertId: 'abc' },
    );
    const payload = err.getResponse() as Record<string, unknown>;
    expect(payload.meta).toEqual({ alertId: 'abc' });
  });

  it('errorCode namespaced dot-separator preservado', () => {
    const err = new AppException(
      'LISTS.NOT_FOUND',
      'Lista x',
      HttpStatus.NOT_FOUND,
    );
    expect(err.errorCode).toBe('LISTS.NOT_FOUND');
  });
});
