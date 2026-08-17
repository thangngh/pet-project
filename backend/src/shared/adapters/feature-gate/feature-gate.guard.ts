import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureGateService } from './feature-gate.service';
import { GATE_KEY, FeatureFlag } from './feature-gate.types';
import { GateException, MaintenanceException } from './gate-exception';
import { SKIP_GATE_KEY } from './skip-gate.decorator';

@Injectable()
export class GateGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureGateService: FeatureGateService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // 0. Probes are exempt from every gate. Without this, maintenance mode
    //    fails the liveness check and the orchestrator restarts the process
    //    that is deliberately locked.
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_GATE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    // 1. Global maintenance mode
    if (this.featureGateService.isApiLocked()) {
      throw new MaintenanceException();
    }

    // 2. Per-endpoint gate
    const feature = this.reflector.getAllAndOverride<FeatureFlag>(GATE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!feature) return true; // no gate → allow

    if (!this.featureGateService.isEnabled(feature)) {
      throw new GateException(feature);
    }

    return true;
  }
}
