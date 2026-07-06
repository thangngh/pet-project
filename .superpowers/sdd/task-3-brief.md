## Task 3: Update RolesGuard to Use Constants

**Goal:** Replace hard‑coded role strings in `RolesGuard` with the newly created constants.

**File to modify:** `backend/src/modules/auth/adapters/outbound/auth/roles.guard.ts`

**Changes:**
1. Add import:
```ts
import { ROLE_ADMIN, ROLE_USER, ROLE_SERVICE } from '../../../application/constants/role.constants';
```
2. Ensure any role checks use these constants (e.g. `requiredRoles.includes(ROLE_ADMIN)`).

**Commit message:** `refactor: use role constants in RolesGuard`
