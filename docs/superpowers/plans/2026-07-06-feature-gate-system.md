# Feature Gate System — Phase 1B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-endpoint feature gating (`@Gate`) with global maintenance mode (`API_LOCKED`).

**Architecture:** Global `GateGuard` as `APP_GUARD` checks `FeatureGateService` for `@Gate` metadata. Disabled features return 503. Uses `ConfigService` for env-driven flags.

**Tech Stack:** NestJS 10, ConfigModule, Reflector.

## Global Constraints
- Feature flag env vars: `FEATURE_<NAME>=true/false`
- Access via `ConfigService.get('app.features.<camelCase>')`
- Maintenance mode: `API_LOCKED=true` blocks ALL routes
- `@Gate` metadata key: `'gate'`
- `GateException` → 503 with `FEATURE_DISABLED` code
- GlobalExceptionFilter must handle `GateException`

---

### Task 1: Types + GateException

**Files:**
- Create: `backend/src/shared/adapters/feature-gate/feature-gate.types.ts`
- Create: `backend/src/shared/adapters/feature-gate/gate-exception.ts`

- [ ] **Step 1: Create types file**

```ts
// feature-gate.types.ts
export const GATE_KEY = 'gate';

export type FeatureFlag =
  | 'userProfile'
  | 'productCatalog'
  | 'shipping';

export interface GateMetadata {
  feature: FeatureFlag;
}
```

- [ ] **Step 2: Create GateException**

```ts
// gate-exception.ts
export class GateException extends Error {
  public readonly feature: string;

  constructor(feature: string) {
    super(`Feature '${feature}' is currently disabled`);
    this.name = 'GateException';
    this.feature = feature;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/shared/adapters/feature-gate/feature-gate.types.ts backend/src/shared/adapters/feature-gate/gate-exception.ts
git commit -m "feat: add feature gate types and GateException"
```

---

### Task 2: FeatureGateService

**Files:**
- Create: `backend/src/shared/adapters/feature-gate/feature-gate.service.ts`

- [ ] **Step 1: Create service**

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FeatureFlag, GateMetadata } from './feature-gate.types';

@Injectable()
export class FeatureGateService {
  constructor(private readonly configService: ConfigService) {}

  isEnabled(feature: FeatureFlag): boolean {
    return this.configService.get<boolean>(`app.features.${feature}`) ?? false;
  }

  isApiLocked(): boolean {
    return this.configService.get<boolean>('app.gate.apiLocked') ?? false;
  }

  getMetadata(feature: FeatureFlag): GateMetadata {
    return { feature };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/shared/adapters/feature-gate/feature-gate.service.ts
git commit -m "feat: add FeatureGateService"
```

---

### Task 3: @Gate decorator

**Files:**
- Create: `backend/src/shared/adapters/feature-gate/gate.decorator.ts`

- [ ] **Step 1: Create decorator**

```ts
import { SetMetadata } from '@nestjs/common';
import { GATE_KEY, FeatureFlag } from './feature-gate.types';

export const Gate = (feature: FeatureFlag) => SetMetadata(GATE_KEY, feature);
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/shared/adapters/feature-gate/gate.decorator.ts
git commit -m "feat: add @Gate decorator"
```

---

### Task 4: GateGuard

**Files:**
- Create: `backend/src/shared/adapters/feature-gate/feature-gate.guard.ts`

- [ ] **Step 1: Create guard**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/shared/adapters/feature-gate/feature-gate.guard.ts
git commit -m "feat: add GateGuard"
```

---

### Task 5: Register in SharedAdaptersModule

**Files:**
- Create: `backend/src/shared/adapters/feature-gate/feature-gate.module.ts`
- Modify: `backend/src/shared/adapters/shared-adapters.module.ts`

- [ ] **Step 1: Create feature-gate module**

```ts
// feature-gate.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { FeatureGateService } from './feature-gate.service';
import { GateGuard } from './feature-gate.guard';

@Module({
  providers: [
    FeatureGateService,
    {
      provide: APP_GUARD,
      useClass: GateGuard,
    },
  ],
  exports: [FeatureGateService],
})
export class FeatureGateModule {}
```

- [ ] **Step 2: Register in SharedAdaptersModule**

```ts
// shared-adapters.module.ts — add to imports array
import { FeatureGateModule } from './feature-gate/feature-gate.module';

@Module({
  imports: [
    // ... existing imports ...
    FeatureGateModule,
  ],
  exports: [
    // ... existing exports ...
    FeatureGateModule,
  ],
})
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/shared/adapters/feature-gate/feature-gate.module.ts backend/src/shared/adapters/shared-adapters.module.ts
git commit -m "feat: register GateGuard globally via FeatureGateModule"
```

---

### Task 6: Update app.config.ts and .env.example

**Files:**
- Modify: `backend/src/shared/adapters/config/app.config.ts`
- Modify: `backend/.env.example`

- [ ] **Step 1: Add gate config to app.config.ts**

```ts
// Inside the existing exports:
gate: {
  apiLocked: process.env.API_LOCKED === 'true',
},
```

- [ ] **Step 2: Add to .env.example**

```env
# Maintenance
API_LOCKED=false

# Feature Gates
FEATURE_USER_PROFILE=false
FEATURE_PRODUCT_CATALOG=false
FEATURE_SHIPPING=false
```

- [ ] **Step 3: Build**

Run: `cd backend && pnpm build`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/shared/adapters/config/app.config.ts backend/.env.example
git commit -m "feat: add gate config and feature flag env vars"
```

---

### Task 7: Update GlobalExceptionFilter for GateException

**Files:**
- Modify: `backend/src/shared/application/filters/global-exception.filter.ts`

- [ ] **Step 1: Add GateException handling**

```ts
import { GateException } from '../../adapters/feature-gate/gate-exception';

// Inside catch():
if (exception instanceof GateException) {
  response.status(503).json({
    statusCode: 503,
    code: 'FEATURE_DISABLED',
    message: exception.message,
    feature: exception.feature,
    timestamp: new Date().toISOString(),
  });
  return;
}
```

- [ ] **Step 2: Build**

Run: `cd backend && pnpm build`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/shared/application/filters/global-exception.filter.ts
git commit -m "feat: handle GateException in GlobalExceptionFilter"
```

---

### Task 8: Unit Tests

**Files:**
- Create: `backend/src/shared/adapters/feature-gate/feature-gate.service.spec.ts`
- Create: `backend/src/shared/adapters/feature-gate/feature-gate.guard.spec.ts`

- [ ] **Step 1: Service test**

```ts
// feature-gate.service.spec.ts
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FeatureGateService } from './feature-gate.service';

describe('FeatureGateService', () => {
  let service: FeatureGateService;
  let config: { get: jest.Mock };

  beforeEach(async () => {
    config = { get: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        FeatureGateService,
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = module.get(FeatureGateService);
  });

  it('returns false when feature not configured', () => {
    config.get.mockReturnValue(undefined);
    expect(service.isEnabled('userProfile')).toBe(false);
  });

  it('returns true when feature enabled', () => {
    config.get.mockReturnValue(true);
    expect(service.isEnabled('userProfile')).toBe(true);
  });

  it('detects API lock', () => {
    config.get.mockReturnValue(true);
    expect(service.isApiLocked()).toBe(true);
  });
});
```

- [ ] **Step 2: Guard test**

```ts
// feature-gate.guard.spec.ts
import { GateGuard } from './feature-gate.guard';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureGateService } from './feature-gate.service';
import { GateException } from './gate-exception';

describe('GateGuard', () => {
  let guard: GateGuard;
  let reflector: Reflector;
  let gateService: { isApiLocked: jest.Mock; isEnabled: jest.Mock };

  const mockContext = (): ExecutionContext =>
    ({
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = new Reflector();
    gateService = { isApiLocked: jest.fn(), isEnabled: jest.fn() };
    guard = new GateGuard(reflector, gateService as any);
  });

  it('blocks when API locked', () => {
    gateService.isApiLocked.mockReturnValue(true);
    expect(() => guard.canActivate(mockContext())).toThrow(GateException);
  });

  it('allows when no gate metadata', () => {
    gateService.isApiLocked.mockReturnValue(false);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(mockContext())).toBe(true);
  });

  it('blocks when feature disabled', () => {
    gateService.isApiLocked.mockReturnValue(false);
    gateService.isEnabled.mockReturnValue(false);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('userProfile');
    expect(() => guard.canActivate(mockContext())).toThrow(GateException);
  });

  it('allows when feature enabled', () => {
    gateService.isApiLocked.mockReturnValue(false);
    gateService.isEnabled.mockReturnValue(true);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('userProfile');
    expect(guard.canActivate(mockContext())).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd backend && pnpm test`
Expected: PASS (both new test files)

- [ ] **Step 4: Commit**

```bash
git add backend/src/shared/adapters/feature-gate/feature-gate.service.spec.ts backend/src/shared/adapters/feature-gate/feature-gate.guard.spec.ts
git commit -m "test: FeatureGateService and GateGuard unit tests"
```

---

### Task 9: Final Build & Push

- [ ] **Step 1: Full build**

Run: `cd backend && pnpm build`
Expected: 0 errors

- [ ] **Step 2: Full test suite**

Run: `cd backend && pnpm test`
Expected: All PASS

- [ ] **Step 3: Push**

```bash
git push origin main
```
