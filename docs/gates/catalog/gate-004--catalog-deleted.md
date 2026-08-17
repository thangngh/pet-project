# Gate: catalog

## Gate Run: 004
**Date:** 2026-08-17
**Feature:** catalog — CatalogDeleted publication
**Gate Type:** rerun

## Decision Context
- **Feature:** Archiving a catalog must archive the products under it
- **Status:** gate-003 recorded publication as a known gap; this run closes it
- **Dependencies:** shared event bus, Product context consumer

## Criteria
- [x] `Catalog.archive()` collects `CatalogDeletedEvent`
- [x] `ArchiveCatalogUseCase` publishes after the save succeeds
- [x] The event carries primitives only, so Product imports no Catalog domain type
- [x] Archiving twice does not publish twice
- [x] Delivery proved through the real EventBus, not a mock
- [ ] Durable delivery — no outbox, see Issues

## Decision
PASS
**Reason:** The producer side is implemented and the event reaches the Product
context through the real bus. Durability remains phase work.

## Evaluation Result

### Outcome
**Gate decision:** PASS
**Action:** The archival flow now runs end to end in process.

### Evidence
- Build: 0 errors
- Tests: 53 across 11 suites, all passing (was 46 across 9)
- `integration-events.spec.ts` publishes `CatalogDeletedEvent` through the real
  `EventBus` and asserts `archiveByCatalogId` is called with the id
- Reverting the consumer to `@EventsHandler()` fails that test, so it covers the
  original defect rather than restating the new code
- Unit tests assert publish happens after save, that the payload carries the
  catalog id, and that a second archive publishes nothing

### What was wrong
`ArchiveCatalogUseCase` archived the aggregate and saved it without emitting.
`Catalog.archive()` collected no event, and the entity had no event collection
at all. `CatalogDeletedEvent` existed but nothing ever constructed it.

The class lived in `catalog/domain/entities/`, where the Product context could
not import it without reaching into another context's domain. It now lives in
`shared/adapters/event-bus/integration-events/` and carries a plain string id.

### Issues Found
1. **No outbox.** Publication is in-process. If the process dies between the
   save and the handler running, the products stay active with no retry. The
   roadmap's Phase 2 Definition of Done requires an outbox; this is phase work,
   not started here.
2. **Name predates behaviour.** Nothing is deleted — the catalog is archived.
   The name is kept so existing gate and checkpoint records stay readable.
3. **No integration test.** `archiveByCatalogId` against PostgreSQL is still
   unverified; no Docker daemon is available in this environment.

### Next Step
Schedule the outbox as its own slice, then verify `archiveByCatalogId` against a
real database.
