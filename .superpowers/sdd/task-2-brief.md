## Task 2: Extend RequestIdentity Interface

**Goal:** Add optional `attributes` map to the `RequestIdentity` interface for future ABAC support.

**File to modify:** `backend/src/modules/auth/application/ports/auth-middleware.port.ts`

**Modification:** Replace the existing `RequestIdentity` definition with:
```ts
export interface RequestIdentity {
  userId: string;
  roles: string[];
  authMethod: 'jwt' | 'api_key';
  /** optional ABAC attributes, e.g. tenantId, region, timeOfDay */
  attributes?: Record<string, any>;
}
```

**Commit message:** `feat: extend RequestIdentity for ABAC`
