import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GateGuard } from './feature-gate.guard';
import { FeatureGateService } from './feature-gate.service';
import { GateException, MaintenanceException } from './gate-exception';
import { SKIP_GATE_KEY } from './skip-gate.decorator';
import { GATE_KEY } from './feature-gate.types';

describe('GateGuard', () => {
  let reflector: Reflector;
  let service: { isEnabled: jest.Mock; isApiLocked: jest.Mock };
  let guard: GateGuard;

  const context = () =>
    ({
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    }) as unknown as ExecutionContext;

  /** Mimics the reflector reading decorator metadata off a route. */
  const metadata = (values: Record<string, unknown>) =>
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key: string) => values[key] as never);

  beforeEach(() => {
    reflector = new Reflector();
    service = { isEnabled: jest.fn(), isApiLocked: jest.fn() };
    guard = new GateGuard(reflector, service as unknown as FeatureGateService);
  });

  it('allows an ungated route', () => {
    service.isApiLocked.mockReturnValue(false);
    metadata({});
    expect(guard.canActivate(context())).toBe(true);
  });

  it('allows a gated route whose feature is enabled', () => {
    service.isApiLocked.mockReturnValue(false);
    service.isEnabled.mockReturnValue(true);
    metadata({ [GATE_KEY]: 'productCatalog' });

    expect(guard.canActivate(context())).toBe(true);
  });

  describe('a disabled feature', () => {
    beforeEach(() => {
      service.isApiLocked.mockReturnValue(false);
      service.isEnabled.mockReturnValue(false);
      metadata({ [GATE_KEY]: 'productCatalog' });
    });

    it('is 503, not 500 — unavailable is not broken', () => {
      try {
        guard.canActivate(context());
        fail('expected the guard to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(GateException);
        expect((error as GateException).getStatus()).toBe(
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
    });

    it('names itself, so a client can tell which feature is off', () => {
      try {
        guard.canActivate(context());
        fail('expected the guard to throw');
      } catch (error) {
        expect((error as GateException).getResponse()).toMatchObject({
          code: 'FEATURE_DISABLED',
          feature: 'productCatalog',
        });
      }
    });
  });

  describe('maintenance mode', () => {
    beforeEach(() => service.isApiLocked.mockReturnValue(true));

    it('locks every route with its own code', () => {
      metadata({});
      try {
        guard.canActivate(context());
        fail('expected the guard to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(MaintenanceException);
        expect((error as GateException).getStatus()).toBe(
          HttpStatus.SERVICE_UNAVAILABLE,
        );
        expect((error as GateException).getResponse()).toMatchObject({
          code: 'API_LOCKED',
        });
      }
    });

    it('leaves a @SkipGate() probe alone', () => {
      // Otherwise the liveness check fails and the orchestrator restarts the
      // process that is deliberately in maintenance.
      metadata({ [SKIP_GATE_KEY]: true });
      expect(guard.canActivate(context())).toBe(true);
    });
  });
});
