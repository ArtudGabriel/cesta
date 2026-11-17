import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Sprint 92: valida que o request tem user autenticado com role `admin`.
 * Opera em cima de req.user populado pelo JwtAuthGuard — que já busca
 * roles frescos do banco a cada request, garantindo revogação imediata.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = req.user;
    if (!user || !user.roles?.includes('admin')) {
      throw new ForbiddenException('Admin required');
    }
    return true;
  }
}
