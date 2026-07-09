import { AttributesGuard, ATTRIBUTES_KEY } from './attributes.guard';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

describe('AttributesGuard', () => {
  let guard: AttributesGuard;
  let reflector: Reflector;
  let configService: ConfigService;

  const mockContext = (attrs: Record<string, any>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          identity: { userId: 'u1', roles: [], authMethod: 'jwt', attributes: attrs },
        }),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = new Reflector();
    configService = { get: jest.fn() } as unknown as ConfigService;
    guard = new AttributesGuard(reflector, configService);
  });

  it('passes when ABAC disabled', () => {
    (configService.get as jest.Mock).mockReturnValue(false);
    expect(guard.canActivate(mockContext({}))).toBe(true);
  });

  it('allows when required attribute matches', () => {
    (configService.get as jest.Mock).mockReturnValue(true);
    jest.spyOn(reflector, 'get').mockReturnValue({ region: 'vn' });
    expect(guard.canActivate(mockContext({ region: 'vn' }))).toBe(true);
  });

  it('denies when attribute mismatches', () => {
    (configService.get as jest.Mock).mockReturnValue(true);
    jest.spyOn(reflector, 'get').mockReturnValue({ region: 'vn' });
    expect(guard.canActivate(mockContext({ region: 'us' }))).toBe(false);
  });

  it('allows when no attributes required', () => {
    (configService.get as jest.Mock).mockReturnValue(true);
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);
    expect(guard.canActivate(mockContext({}))).toBe(true);
  });

  it('denies when identity has no attributes', () => {
    (configService.get as jest.Mock).mockReturnValue(true);
    jest.spyOn(reflector, 'get').mockReturnValue({ region: 'vn' });
    expect(guard.canActivate(mockContext({}))).toBe(false);
  });
});
