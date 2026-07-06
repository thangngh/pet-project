## Task 5: Add @Attributes() Decorator

**Goal:** Provide a decorator to specify required ABAC attributes on controller methods.

**File to create:** `backend/src/modules/auth/adapters/outbound/auth/attributes.decorator.ts`

**Content:**
```ts
import { SetMetadata } from '@nestjs/common';

export const ATTRIBUTES_KEY = 'attributes';
export const Attributes = (attrs: Record<string, any>) => SetMetadata(ATTRIBUTES_KEY, attrs);
```

**Commit message:** `feat: add @Attributes decorator`
