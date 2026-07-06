## Task 6: Wire AttributesGuard into AuthModule

**Goal:** Register `AttributesGuard` as a global guard in `AuthModule`.

**File to modify:** `backend/src/modules/auth/auth.module.ts`

**Changes:**
1. Add imports:
```ts
import { APP_GUARD } from '@nestjs/core';
import { AttributesGuard } from './adapters/outbound/auth/attributes.guard';
```
2. Add provider entry:
```ts
{
  provide: APP_GUARD,
  useClass: AttributesGuard,
},
```
3. Ensure the guard is listed after other providers.

**Commit message:** `feat: register AttributesGuard globally`
