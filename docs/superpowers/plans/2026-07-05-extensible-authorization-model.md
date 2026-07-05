# Extensible Authorization Model Implementation Plan

> **For agentic workers:** REQUIRED SUB‑SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task‑by‑task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a basic role system and prepare the codebase for future RBAC / ABAC extensions without breaking existing functionality.

**Architecture:** Extend the Auth BC only (pure Domain unchanged); expose new role constants and an optional `attributes` map on `RequestIdentity`. Implement a lightweight `AttributesGuard` that can be used alongside the existing `RolesGuard`. All changes stay within the Hexagonal ports & adapters layers.

**Tech Stack:** NestJS 10, TypeScript, JWT / API‑Key auth, Winston logger, ConfigModule (Joi), Jest for testing.

## Global Constraints
- **DDD purity:** Domain layer must not import any NestJS or external packages.
- **Hexagonal boundaries:** All new code lives in `modules/auth` (ports → adapters).
- **Naming:** Files & symbols follow existing naming conventions (`*.guard.ts`, `*.constants.ts`).
- **Testing:** 100% test coverage for new guards; tests must run with `pnpm test`.
- **Feature flags:** Add `FEATURE_RBAC` and `FEATURE_ABAC` env vars (default `false`).

---

### Task 1: Create Role Constants

**Files:**
- Create: `backend/src/modules/auth/application/constants/role.constants.ts`

**Interfaces:**
- Produces: `ROLE_ADMIN`, `ROLE_USER`, `ROLE_SERVICE` string constants used by Tasks 3, 8.

- [ ] **Step 1: Create constants file**

```ts
// backend/src/modules/auth/application/constants/role.constants.ts
export const ROLE_ADMIN = 'ADMIN';
export const ROLE_USER = 'USER';
export const ROLE_SERVICE = 'SERVICE';
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/modules/auth/application/constants/role.constants.ts
git commit -m "feat: add role constants"
```

---

### Task 2: Extend `RequestIdentity` Interface

**Files:**
- Modify: `backend/src/modules/auth/application/ports/auth-middleware.port.ts`

**Interfaces:**
- Produces: `RequestIdentity.attributes?: Record<string, any>` consumed by Tasks 4, 9.

- [ ] **Step 1: Update the interface**

```ts
export interface RequestIdentity {
  userId: string;
  roles: string[];
  authMethod: 'jwt' | 'api_key';
  /** optional ABAC attributes, e.g. tenantId, region, timeOfDay */
  attributes?: Record<string, any>;
}
```

- [ ] **Step 2: Run lint**

Run: `cd backend && pnpm lint`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/auth/application/ports/auth-middleware.port.ts
git commit -m "feat: extend RequestIdentity for ABAC"
```

---

### Task 3: Update RolesGuard to Use Constants

**Files:**
- Modify: `backend/src/modules/auth/adapters/outbound/auth/roles.guard.ts`

**Interfaces:**
- Consumes: `ROLE_ADMIN`, `ROLE_USER`, `ROLE_SERVICE` from Task 1.

- [ ] **Step 1: Add import and replace hard‑coded strings**

```ts
import { ROLE_ADMIN, ROLE_USER, ROLE_SERVICE } from '../../../application/constants/role.constants';
```

- [ ] **Step 2: Verify guard logic uses `requestIdentity.roles.includes(role)`**

```ts
const hasRole = requiredRoles.some((r) => requestIdentity.roles.includes(r));
```

- [ ] **Step 3: Run tests**

Run: `cd backend && pnpm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git commit -am "refactor: use role constants in RolesGuard"
```

---

### Task 4: Add `AttributesGuard` Skeleton

**Files:**
- Create: `backend/src/modules/auth/adapters/outbound/auth/attributes.guard.ts`

**Interfaces:**
- Consumes: `RequestIdentity.attributes` from Task 2, `ATTRIBUTES_KEY` from Task 5.
- Produces: `AttributesGuard` class used by Task 6.

- [ ] **Step 1: Write the guard**

```ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestIdentity } from '../../../application/ports/auth-middleware.port';

export const ATTRIBUTES_KEY = 'attributes';

@Injectable()
export class AttributesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required =
      this.reflector.get<Record<string, any>>(ATTRIBUTES_KEY, context.getHandler()) || {};

    if (Object.keys(required).length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const identity: RequestIdentity = request.identity;

    return Object.entries(required).every(
      ([key, value]) => identity.attributes?.[key] === value,
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/modules/auth/adapters/outbound/auth/attributes.guard.ts
git commit -m "feat: add AttributesGuard for ABAC"
```

---

### Task 5: Add `@Attributes()` Decorator

**Files:**
- Create: `backend/src/modules/auth/adapters/outbound/auth/attributes.decorator.ts`

**Interfaces:**
- Produces: `Attributes(attrs)` decorator and `ATTRIBUTES_KEY` used by Task 4, 9.

- [ ] **Step 1: Write decorator**

```ts
import { SetMetadata } from '@nestjs/common';

export const ATTRIBUTES_KEY = 'attributes';
export const Attributes = (attrs: Record<string, any>) => SetMetadata(ATTRIBUTES_KEY, attrs);
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/modules/auth/adapters/outbound/auth/attributes.decorator.ts
git commit -m "feat: add @Attributes decorator"
```

---

### Task 6: Wire AttributesGuard into AuthModule

**Files:**
- Modify: `backend/src/modules/auth/auth.module.ts`

**Interfaces:**
- Consumes: `AttributesGuard` from Task 4.

- [ ] **Step 1: Import and register as global guard**

```ts
import { AttributesGuard } from './adapters/outbound/auth/attributes.guard';
import { APP_GUARD } from '@nestjs/core';

// Add to providers:
{ provide: APP_GUARD, useClass: AttributesGuard },
```

- [ ] **Step 2: Run build**

Run: `cd backend && pnpm build`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git commit -am "feat: register AttributesGuard globally"
```

---

### Task 7: Add Feature‑Flag Config for RBAC/ABAC

**Files:**
- Modify: `backend/.env.example`
- Modify: `backend/src/shared/adapters/config/app.config.ts` (Joi schema)
- Modify: `backend/src/shared/adapters/feature-gate/feature-gate.service.ts`

- [ ] **Step 1: Add env vars to `.env.example`**

```env
# Authorization feature gates
FEATURE_RBAC=false
FEATURE_ABAC=false
```

- [ ] **Step 2: Add Joi validation in config**

```ts
FEATURE_RBAC: Joi.boolean().default(false),
FEATURE_ABAC: Joi.boolean().default(false),
```

- [ ] **Step 3: Add getters in FeatureGateService**

```ts
isRbacEnabled(): boolean {
  return this.configService.get<boolean>('app.features.rbac');
}
isAbacEnabled(): boolean {
  return this.configService.get<boolean>('app.features.abac');
}
```

- [ ] **Step 4: Guard short‑circuit — RolesGuard returns `true` when RBAC disabled; AttributesGuard returns `true` when ABAC disabled**

- [ ] **Step 5: Run tests**

Run: `cd backend && pnpm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git commit -am "feat: feature flags for RBAC/ABAC"
```

---

### Task 8: Unit Tests — RolesGuard

**Files:**
- Create: `backend/src/modules/auth/adapters/outbound/auth/roles.guard.spec.ts`

- [ ] **Step 1: Write failing test**

```ts
import { RolesGuard } from './roles.guard';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLE_ADMIN, ROLE_USER } from '../../../application/constants/role.constants';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

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
    guard = new RolesGuard(reflector);
  });

  it('allows when role matches', () => {
    jest.spyOn(reflector, 'get').mockReturnValue([ROLE_ADMIN]);
    expect(guard.canActivate(mockContext([ROLE_ADMIN, ROLE_USER]))).toBe(true);
  });

  it('denies when role missing', () => {
    jest.spyOn(reflector, 'get').mockReturnValue([ROLE_ADMIN]);
    expect(guard.canActivate(mockContext([ROLE_USER]))).toBe(false);
  });

  it('allows when no roles required', () => {
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);
    expect(guard.canActivate(mockContext([ROLE_USER]))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test**

Run: `cd backend && pnpm jest -- src/modules/auth/adapters/outbound/auth/roles.guard.spec.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git commit -am "test: RolesGuard unit tests"
```

---

### Task 9: Unit Tests — AttributesGuard

**Files:**
- Create: `backend/src/modules/auth/adapters/outbound/auth/attributes.guard.spec.ts`

- [ ] **Step 1: Write failing test**

```ts
import { AttributesGuard } from './attributes.guard';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

describe('AttributesGuard', () => {
  let guard: AttributesGuard;
  let reflector: Reflector;

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
    guard = new AttributesGuard(reflector);
  });

  it('allows when required attribute matches', () => {
    jest.spyOn(reflector, 'get').mockReturnValue({ region: 'vn' });
    expect(guard.canActivate(mockContext({ region: 'vn' }))).toBe(true);
  });

  it('denies when attribute mismatches', () => {
    jest.spyOn(reflector, 'get').mockReturnValue({ region: 'vn' });
    expect(guard.canActivate(mockContext({ region: 'us' }))).toBe(false);
  });

  it('allows when no attributes required', () => {
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);
    expect(guard.canActivate(mockContext({}))).toBe(true);
  });

  it('denies when identity has no attributes', () => {
    jest.spyOn(reflector, 'get').mockReturnValue({ region: 'vn' });
    expect(guard.canActivate(mockContext({}))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test**

Run: `cd backend && pnpm jest -- src/modules/auth/adapters/outbound/auth/attributes.guard.spec.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git commit -am "test: AttributesGuard unit tests"
```

---

### Task 10: Verify Spec Documentation

**Files:**
- Verify: `docs/superpowers/specs/2026-07-05-pet-ecommerce-server-design.md`

- [ ] **Step 1: Confirm section 2.6 exists with correct heading**
- [ ] **Step 2: Confirm `RequestIdentity` in spec includes `attributes?: Record<string, any>`**
- [ ] **Step 3: Confirm no stray `TenantContext` references remain**
- [ ] **Step 4: Commit any doc tweaks**

```bash
git commit -am "docs: verify RBAC/ABAC section" --allow-empty
```

---

### Task 11: Final Build & Push

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
