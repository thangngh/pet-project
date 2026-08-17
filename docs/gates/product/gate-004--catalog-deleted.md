# Gate: product

## Gate Run: 004
**Date:** 2026-08-17
**Feature:** product — CatalogDeleted subscription
**Gate Type:** rerun

## Decision Context
- **Feature:** Products under an archived catalog are archived with it
- **Status:** gate-003 recorded the handler as subscribed to nothing
- **Dependencies:** shared event bus, Catalog context producer

## Criteria
- [x] `CatalogDeletedHandler` declares the event class it handles
- [x] Handler is typed, not `event: any`
- [x] Product imports no Catalog domain type
- [x] Delivery proved through the real EventBus
- [x] `ProductController` resolves — `RequestContextService` was unbound
- [ ] `ProductPublished` written to an outbox — none exists

## Decision
PASS
**Reason:** The subscription exists and fires, and the module now builds. The
outbox is phase work recorded as a gap, as at gate-003.

## Evaluation Result

### Outcome
**Gate decision:** PASS
**Action:** Archiving a catalog archives its products.

### Evidence
- Build: 0 errors
- Tests: 53 across 11 suites, all passing
- Publishing `CatalogDeletedEvent` through the real `EventBus` calls
  `archiveByCatalogId('c1')`
- A `CatalogDeletedEvent` does not reach the User context's handler, so the
  binding is per event and not a broadcast

### What was wrong
`@EventsHandler()` was declared with no event class. The decorator stamps
identifying metadata onto each class passed to it and binds the handler to
those ids; with no arguments it binds to nothing, so `handle()` never ran. The
body compensated with `if (event.eventName === 'CatalogDeleted')`, which was
unreachable. Both are gone — the handler takes `CatalogDeletedEvent` and acts.

`ProductModule` also never imported `RequestContextModule` while
`ProductController` injects `RequestContextService`, so the container could not
build the controller. Found by the new AppModule resolution test.

### Issues Found
1. **No outbox**, unchanged from gate-003. `publish-product.use-case.ts` changes
   status without emitting a durable event.
2. **No integration test** for `archiveByCatalogId`; requires a database.

### Next Step
Outbox as its own slice; integration tests once a database is reachable.
