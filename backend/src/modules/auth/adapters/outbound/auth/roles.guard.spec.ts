import { RolesGuard } from './roles.guard';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ROLE_ADMIN, ROLE_USER } from '../../../application/constants/role.constants';

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

  beforeEach(() => {
    reflector = new Reflector();
    configService = { get: jest.fn() } as unknown as ConfigService;
    guard = new RolesGuard(reflector, configService);
  });

  it('passes when RBAC disabled', () => {
    (configService.get as jest.Mock).mockReturnValue(false);
    expect(guard.canActivate(mockContext([]))).toBe(true);
  });

  it('allows when role matches', () => {
    (configService.get as jest.Mock).mockReturnValue(true);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([ROLE_ADMIN]);
    expect(guard.canActivate(mockContext([ROLE_ADMIN, ROLE_USER]))).toBe(true);
  });

  it('denies when role missing', () => {
    (configService.get as jest.Mock).mockReturnValue(true);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([ROLE_ADMIN]);
    expect(guard.canActivate(mockContext([ROLE_USER]))).toBe(false);
  });

  it('allows when no roles required', () => {
    (configService.get as jest.Mock).mockReturnValue(true);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(mockContext([ROLE_USER]))).toBe(true);
  });
});
