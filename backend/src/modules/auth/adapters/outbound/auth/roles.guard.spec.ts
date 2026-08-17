import { RolesGuard } from './roles.guard';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import {
  ROLE_ADMIN,
  ROLE_USER,
} from '../../../domain/constants/role.constants';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;
  let configService: ConfigService;

  const mockContext = (roles: string[]): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          identity: { userId: 'u1', roles, authMethod: 'jwt' },
        }),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    }) as unknown as ExecutionContext;

  const rbac = (enabled: boolean) =>
    (configService.get as jest.Mock).mockReturnValue(enabled);

  const requires = (roles: string[] | undefined) =>
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);

  beforeEach(() => {
    reflector = new Reflector();
    configService = { get: jest.fn() } as unknown as ConfigService;
    guard = new RolesGuard(reflector, configService);
  });

  it('passes when RBAC disabled', () => {
    rbac(false);
    expect(guard.canActivate(mockContext([]))).toBe(true);
  });

  it('allows when role matches', () => {
    rbac(true);
    requires([ROLE_ADMIN]);
    expect(guard.canActivate(mockContext([ROLE_ADMIN, ROLE_USER]))).toBe(true);
  });

  it('denies when role missing', () => {
    rbac(true);
    requires([ROLE_ADMIN]);
    expect(() => guard.canActivate(mockContext([ROLE_USER]))).toThrow(
      ForbiddenException,
    );
  });

  it('allows when no roles required', () => {
    rbac(true);
    requires(undefined);
    expect(guard.canActivate(mockContext([ROLE_USER]))).toBe(true);
  });

  /**
   * The case that would have caught F22.
   *
   * Every test above compares ROLE_ADMIN against ROLE_ADMIN, so it passes for
   * any spelling at all — including the 'ADMIN' the constants used to hold
   * while the whole rest of the system said 'admin'. Self-consistent, and
   * blind to the only thing that mattered.
   *
   * These two tie the guard to values that come from elsewhere: the literal a
   * JWT actually carries, and the literal the controllers actually write.
   */
  describe('against the vocabulary the rest of the system uses', () => {
    it('admits an identity built from a real JWT claim', () => {
      rbac(true);
      requires([ROLE_ADMIN]);

      // What JwtStrategy puts in the identity is the `role` column's value,
      // and the column defaults to 'user' — lowercase, from the migration.
      const fromToken = { role: 'admin' };
      const identity = fromToken.role ? [fromToken.role] : [];

      expect(guard.canActivate(mockContext(identity))).toBe(true);
    });

    it('denies a non-admin identity built the same way', () => {
      rbac(true);
      requires([ROLE_ADMIN]);

      expect(() => guard.canActivate(mockContext(['user']))).toThrow(
        ForbiddenException,
      );
    });

    it('spells the constants the way the database and the tokens do', () => {
      // If ROLE_ADMIN drifts back to 'ADMIN', this fails here rather than
      // locking out every admin endpoint in production.
      expect(ROLE_ADMIN).toBe('admin');
      expect(ROLE_USER).toBe('user');
    });
  });
});
