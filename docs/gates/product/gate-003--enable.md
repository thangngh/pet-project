# Gate: product

## Gate Run: 003
**Date:** 2026-08-06
**Feature:** product (Product Context — Phase 2B)
**Gate Type:** final-enable

## Decision Context
- **Feature:** Product CRUD, search, attributes, media management
- **Status:** gate-002 conditions met — tests added, bootstrap blocker resolved
- **Dependencies:** Catalog BC (CatalogDeleted event), Auth BC, FeatureGate config

## Criteria
- [x] Domain entities created (Product, ProductAttribute, ProductMedia)
- [x] Use cases implemented (10)
- [x] Domain layer is pure TypeScript
- [x] Controller wired with @Gate('productCatalog') + JwtAuthGuard
- [x] Build passes
- [x] **Unit tests exist** — was the gate-002 gap
- [x] Missing products return 404, absent identity returns 401, both were 500
- [x] Application bootstraps at DI level
- [ ] `CatalogDeleted` handler actually receives events — see Issues
- [ ] `ProductPublished` written to outbox — no outbox exists (Phase 2 DoD)

## Decision
PASS
**Reason:** The product feature itself is implemented, covered and correctly mapped. The
two unmet criteria are cross-cutting work outside this feature's own surface, recorded
here rather than counted as delivered.

## Evaluation Result

### Outcome
**Gate decision:** PASS
**Action:** `FEATURE_PRODUCT_CATALOG=true` is backed by working product code, with the
event-driven archival path documented as not functioning.

### Evidence
- Build: 0 errors
- Tests: 20 tests across the product use cases and the `Product` aggregate
  — was 0 spec files at gate-002
- Lint: 0 non-formatting errors
- Endpoints: 10/10 carry `@Gate('productCatalog')`
- Domain purity: verified — no package imports under `domain/`
- Error mapping: eight use cases now raise `NotFoundError` (404); `product.controller.ts`
  raises `UnauthorizedException` (401) where it previously threw a bare `Error` (500)

### Test coverage added
Draft-on-create with distinct generated ids, publish and archive transitions, caller-supplied
attribute and media ids, primary-media exclusivity, `updateDetails` preserving an omitted
description, search result mapping with totals, and `NotFoundError` on every lookup path.

### Issues Found
1. **`CatalogDeletedHandler` is subscribed to nothing.** It is declared
   `@EventsHandler()` with no event class, so `@nestjs/cqrs` registers it for no event
   type. The handler body guards on `event.eventName === 'CatalogDeleted'`, which never
   runs. The producer side is also missing — `CatalogDeletedEvent` is never published
   (see `docs/gates/catalog/gate-003--enable.md`). So the flow is broken at both ends
   despite `checkpoint-2026-07-10-01` listing the handler as a delivered component.
   Fixing it requires deciding how a BC subscribes to another BC's event without
   importing its domain type, so it is left for a dedicated change.
2. **Outbox missing.** The roadmap's Phase 2 Definition of Done requires
   "ProductPublished event is written to outbox". No outbox exists and
   `publish-product.use-case.ts` changes status without emitting a durable event.
   This is phase work, deliberately not started here.
3. **No integration test.** Repository behaviour against PostgreSQL is unverified; no
   Docker daemon is available in this environment.

### Next Step
Decide the cross-BC event contract and fix the `CatalogDeleted` flow at both ends, then
schedule the outbox as its own slice.
