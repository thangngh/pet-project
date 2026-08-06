# Gate: catalog

## Gate Run: 003
**Date:** 2026-08-06
**Feature:** catalog (Catalog Context — Phase 2A)
**Gate Type:** final-enable

## Decision Context
- **Feature:** Catalog tree management (CRUD + tree view)
- **Status:** gate-002 conditions met — tests added, bootstrap blocker resolved
- **Dependencies:** Auth BC (JwtAuthGuard, RolesGuard), FeatureGate config

## Criteria
- [x] Domain entity + events created (Catalog, CatalogDeleted)
- [x] Use cases implemented (Create, Update, Archive, GetTree, GetCatalog)
- [x] `GET /catalogs/:id` returns a single catalog
- [x] Controller wired with @Gate('productCatalog') + JwtAuthGuard + RolesGuard
- [x] Build passes
- [x] **Unit tests exist** — was the gate-002 gap
- [x] Missing catalogs return 404 rather than 500
- [x] Application bootstraps at DI level
- [ ] `CatalogDeleted` is actually published — see Issues

## Decision
PASS
**Reason:** CRUD, the tree builder and error mapping are implemented and covered. The
unpublished `CatalogDeleted` event is recorded as a known gap rather than silently
counted as delivered, as gate-001 did.

## Evaluation Result

### Outcome
**Gate decision:** PASS
**Action:** `FEATURE_PRODUCT_CATALOG=true` is backed by working catalog code.

### Evidence
- Build: 0 errors
- Tests: 10 tests across the 4 catalog use cases plus `GetCatalogUseCase`
  — was 0 spec files at gate-002
- Lint: 0 non-formatting errors
- Endpoints: 5/5 carry `@Gate('productCatalog')`; writes additionally carry `@Roles('admin')`
- Error mapping: `update-catalog` and `archive-catalog` now raise `NotFoundError` (404);
  both previously produced 500

### Test coverage added
Single-catalog retrieval including the id-is-honoured regression, tree nesting to two
levels, orphan rows whose parent is absent, rename-and-persist, archive-and-persist,
and `NotFoundError` on every lookup path.

### Issues Found
1. **`CatalogDeletedEvent` is never published.** The class exists at
   `domain/entities/catalog-deleted.event.ts`, but nothing constructs it.
   `ArchiveCatalogUseCase` archives the aggregate and saves it without emitting an event,
   and `Catalog.archive()` collects no domain event. The consumer side is broken too —
   see `docs/gates/product/gate-003--enable.md`. The cross-context flow
   "CatalogDeleted → archive products" does not run, though
   `checkpoint-2026-07-10-01` listed it as delivered.
   Wiring it needs a decision on the cross-BC event contract, so it is left for a
   dedicated change rather than resolved here.
2. **No integration test.** Repository behaviour against PostgreSQL is unverified; no
   Docker daemon is available in this environment.

### Next Step
Decide the cross-BC event contract, then implement publication of `CatalogDeleted`
together with its consumer.
