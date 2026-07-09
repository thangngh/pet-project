# RequestContext — Phase 1C

**Date:** 2026-07-06
**Status:** Draft

## Design

### Components

```
backend/src/shared/adapters/request-context/
├── request-context.service.ts     # CLS-based context holder
├── request-context.middleware.ts   # Express middleware: generate/read headers
├── request-context.module.ts      # Module registration
└── request-context.types.ts       # RequestIdentity interface (ref from auth)
```

### Data Flow

```
Incoming Request
  → RequestContextMiddleware
    → Reads or generates X-Request-Id, X-Correlation-Id
    → Sets values on RequestContextService (via CLS / async_hooks)
  → Controller / Guard
    → Reads identity from request → sets on RequestContext
  → LoggingInterceptor
    → Reads requestId + correlationId from RequestContext
    → Attaches to each log entry
  → Use case
    → Reads userId from RequestContext for ownership checks
```

### Files

| Action | File |
|--------|------|
| Create | `backend/src/shared/adapters/request-context/request-context.types.ts` |
| Create | `backend/src/shared/adapters/request-context/request-context.service.ts` |
| Create | `backend/src/shared/adapters/request-context/request-context.middleware.ts` |
| Create | `backend/src/shared/adapters/request-context/request-context.module.ts` |
| Modify | `backend/src/shared/adapters/shared-adapters.module.ts` |
| Modify | `backend/src/shared/adapters/logger/logging.interceptor.ts` |
