## Task 7: Add Feature‑Flag Config for RBAC/ABAC

**Goal:** Introduce environment variables to enable/disable RBAC and ABAC features at runtime.

**Files to modify:**
1. `backend/.env.example` – add `FEATURE_RBAC=false` and `FEATURE_ABAC=false`.
2. `backend/src/shared/adapters/config/app.config.ts` – extend Joi schema with:
```ts
FEATURE_RBAC: Joi.boolean().default(false),
FEATURE_ABAC: Joi.boolean().default(false),
```
3. `backend/src/shared/adapters/feature-gate/feature-gate.service.ts` – add getters:
```ts
isRbacEnabled(): boolean { return this.configService.get<boolean>('app.features.rbac'); }
isAbacEnabled(): boolean { return this.configService.get<boolean>('app.features.abac'); }
```
4. Update `RolesGuard` and `AttributesGuard` to short‑circuit when respective flags are disabled.
   - In `RolesGuard.canActivate`, before role checks: `if (!this.featureGateService.isRbacEnabled()) return true;`
   - In `AttributesGuard.canActivate`, before attribute checks: `if (!this.featureGateService.isAbacEnabled()) return true;`

**Commit message:** `feat: feature flags for RBAC/ABAC`
