# Feature Gate System — Phase 1B

**Date:** 2026-07-06
**Status:** Draft
**Phase:** 1B (Foundation)

## Purpose

Provide a per-endpoint feature gating mechanism that allows disabling incomplete features in production without code deployment. The gate system works alongside the existing `RolesGuard` and `AttributesGuard`.

## Design

### Components

```
backend/src/shared/adapters/feature-gate/
├── feature-gate.module.ts        # Module registration
├── feature-gate.service.ts       # Reads gate config from ConfigService
├── feature-gate.guard.ts         # Global GateGuard
├── gate.decorator.ts             # @Gate('feature-name')
└── feature-gate.types.ts         # Types
```

### Flow

```
Request → GateGuard (global) → @Gate('name') → FeatureGateService.isEnabled('name')
  → disabled: throw GateException → GlobalExceptionFilter → 503 { code: "FEATURE_DISABLED" }
  → enabled: pass through
```

### Gate Levels

| Level | Mechanism | Effect |
|-------|-----------|--------|
| Global | `GateGuard` + `API_LOCKED` env | Blocks ALL routes, maintenance mode |
| Per-feature | `@Gate('feature-name')` | Blocks specific endpoint group |

### Config

```env
# Maintenance
API_LOCKED=false

# Feature Gates
FEATURE_USER_PROFILE=false
FEATURE_PRODUCT_CATALOG=false
FEATURE_SHIPPING=false
```

Access via config namespace: `app.features.userProfile`, `app.gate.apiLocked`.

### Error Response

```json
{
  "statusCode": 503,
  "code": "FEATURE_DISABLED",
  "message": "Feature 'user-profile' is currently disabled",
  "feature": "user-profile",
  "timestamp": "2026-07-06T12:00:00.000Z",
  "path": "/api/me"
}
```

### Files Affected

| Action | File |
|--------|------|
| Create | `backend/src/shared/adapters/feature-gate/feature-gate.types.ts` |
| Create | `backend/src/shared/adapters/feature-gate/feature-gate.service.ts` |
| Create | `backend/src/shared/adapters/feature-gate/feature-gate.guard.ts` |
| Create | `backend/src/shared/adapters/feature-gate/gate.decorator.ts` |
| Create | `backend/src/shared/adapters/feature-gate/feature-gate.module.ts` |
| Modify | `backend/src/shared/adapters/config/app.config.ts` |
| Modify | `backend/src/shared/adapters/shared-adapters.module.ts` |
| Modify | `backend/.env.example` |
| Modify | `backend/src/shared/application/filters/global-exception.filter.ts` |
| Create | `backend/src/shared/adapters/feature-gate/feature-gate.guard.spec.ts` |
| Create | `backend/src/shared/adapters/feature-gate/feature-gate.service.spec.ts` |
