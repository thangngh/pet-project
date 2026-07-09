## Task 1: Types + GateException

**Goal:** Create feature gate types and GateException class.

**Files to create:**
1. `backend/src/shared/adapters/feature-gate/feature-gate.types.ts`
2. `backend/src/shared/adapters/feature-gate/gate-exception.ts`

**Content (exact):**

`feature-gate.types.ts`:
```ts
export const GATE_KEY = 'gate';

export type FeatureFlag =
  | 'userProfile'
  | 'productCatalog'
  | 'shipping';

export interface GateMetadata {
  feature: FeatureFlag;
}
```

`gate-exception.ts`:
```ts
export class GateException extends Error {
  public readonly feature: string;

  constructor(feature: string) {
    super(`Feature '${feature}' is currently disabled`);
    this.name = 'GateException';
    this.feature = feature;
  }
}
```

**Steps:**
1. Create both files at exact paths
2. Commit: `feat: add feature gate types and GateException`
