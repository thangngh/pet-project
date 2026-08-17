import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RequestContextService } from '../../../../../shared/adapters/request-context/request-context.service';
import { RequestIdentity } from '../../../../../shared/adapters/request-context/request-context.types';

describe('JwtAuthGuard', () => {
  let requestContext: RequestContextService;
  let guard: JwtAuthGuard;

  const executionContext = (): ExecutionContext =>
    ({
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    }) as unknown as ExecutionContext;

  /** Runs `fn` inside a real async store, as RequestContextMiddleware does. */
  const inRequest = (fn: () => void): void =>
    requestContext.run(
      { requestId: 'req-1', correlationId: 'corr-1' },
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      () => fn(),
    );

  beforeEach(() => {
    requestContext = new RequestContextService();
    guard = new JwtAuthGuard(new Reflector(), requestContext);
  });

  it('writes the authenticated identity into the request context', () => {
    let identity: RequestIdentity | undefined;

    inRequest(() => {
      guard.handleRequest(null, {
        id: 'user-1',
        email: 'someone@example.com',
        role: 'admin',
      });
      identity = requestContext.getIdentity();
    });

    expect(identity).toEqual({
      userId: 'user-1',
      roles: ['admin'],
      authMethod: 'jwt',
    });
  });

  it('returns the user unchanged, so Passport still populates req.user', () => {
    const user = { id: 'user-1', email: 'someone@example.com', role: 'user' };

    inRequest(() => expect(guard.handleRequest(null, user)).toBe(user));
  });

  it('produces an empty roles array rather than [undefined] when the token carries no role', () => {
    let identity: RequestIdentity | undefined;

    inRequest(() => {
      guard.handleRequest(null, { id: 'user-1', email: 'a@b.c' });
      identity = requestContext.getIdentity();
    });

    // [undefined] would satisfy a naive `roles.length` check in RolesGuard.
    expect(identity?.roles).toEqual([]);
  });

  it('rejects a missing user and writes no identity', () => {
    let identity: RequestIdentity | undefined;

    inRequest(() => {
      expect(() => guard.handleRequest(null, null)).toThrow(
        UnauthorizedException,
      );
      identity = requestContext.getIdentity();
    });

    expect(identity).toBeUndefined();
  });

  it('propagates the original error when Passport supplies one', () => {
    const err = new Error('jwt expired');

    inRequest(() => expect(() => guard.handleRequest(err, null)).toThrow(err));
  });

  it('lets a @Public() route through without authenticating', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const publicGuard = new JwtAuthGuard(reflector, requestContext);

    expect(publicGuard.canActivate(executionContext())).toBe(true);
    expect(requestContext.getIdentity()).toBeUndefined();
  });
});
