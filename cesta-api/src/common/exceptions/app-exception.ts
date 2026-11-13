import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Exception com errorCode estável namespaced pra i18n no frontend.
 * Frontend mapeia errorCode → translations.errors.<ns>.<key>; se chave
 * ausente, fallback no `defaultMessage` original.
 *
 * Padrão code: NAMESPACE.CODE_NAME (ex: AUTH.INVALID_CREDENTIALS).
 */
export class AppException extends HttpException {
  constructor(
    public readonly errorCode: string,
    public readonly defaultMessage: string,
    status: HttpStatus,
    public readonly meta?: Record<string, unknown>,
  ) {
    super({ errorCode, message: defaultMessage, meta }, status);
  }
}
