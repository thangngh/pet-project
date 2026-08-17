import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import { RequestContextService } from '../../../../../shared/adapters/request-context/request-context.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly requestContext: RequestContextService,
  ) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  /**
   * Writes the authenticated identity into RequestContext, which is how every
   * layer past this point learns who is calling. Before this, the context was
   * populated with a request id and nothing else, so `getIdentity()` returned
   * undefined on every request and any ownership check silently had nobody to
   * check against.
   *
   * This belongs in the guard rather than the middleware: the middleware runs
   * before guards and cannot tell an authenticated route from a @Public() one,
   * and putting token parsing there would mean two components verify JWTs.
   * `handleRequest` runs inside the async context the middleware opened, so
   * the write lands in the store the application layer later reads.
   */
  handleRequest<TUser = any>(err: any, user: any): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or expired token');
    }

    this.requestContext.setIdentity({
      userId: user.id,
      roles: user.role ? [user.role] : [],
      authMethod: 'jwt',
    });

    return user;
  }
}
