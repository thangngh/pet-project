import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureGateService } from './feature-gate.service';
import { GATE_KEY, FeatureFlag } from './feature-gate.types';
import { GateException } from './gate-exception';

@Injectable()
export class GateGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureGateService: FeatureGateService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Global maintenance mode
    if (this.featureGateService.isApiLocked()) {
      throw new GateException('__api_locked__');
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
