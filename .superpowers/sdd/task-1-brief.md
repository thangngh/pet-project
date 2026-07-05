## Task 1: Create Role Constants

**Goal:** Add a file with exported role constants that will be used by guards and tests.

**File to create:** `backend/src/modules/auth/application/constants/role.constants.ts`

**Content:**
```ts
export const ROLE_ADMIN = 'ADMIN';
export const ROLE_USER = 'USER';
export const ROLE_SERVICE = 'SERVICE';
```