import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Sentry } from '../sentry/sentry.init';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload =
      exception instanceof HttpException ? exception.getResponse() : null;

    const message =
      typeof payload === 'string'
        ? payload
        : (payload as { message?: string | string[] })?.message ||
          (exception instanceof Error ? exception.message : 'Internal server error');

    const errorName =
      typeof payload === 'object' && payload !== null && 'error' in payload
        ? (payload as { error: string }).error
        : HttpStatus[status];

    // AppException (Sprint 38) expõe errorCode namespaced pra i18n frontend.
    const errorCode =
      typeof payload === 'object' && payload !== null && 'errorCode' in payload
        ? (payload as { errorCode: string }).errorCode
        : undefined;

    const meta =
      typeof payload === 'object' && payload !== null && 'meta' in payload
        ? (payload as { meta?: Record<string, unknown> }).meta
        : undefined;

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      Sentry.captureException(exception);
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: errorName,
      ...(errorCode ? { errorCode } : {}),
      ...(meta ? { meta } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
