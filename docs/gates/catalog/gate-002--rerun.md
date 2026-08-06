# Gate: catalog

## Gate Run: 002
**Date:** 2026-08-06
**Feature:** catalog (Catalog Context — Phase 2A)
**Gate Type:** rerun

## Decision Context
- **Feature:** Catalog tree management (CRUD + tree view)
- **Status:** Re-audit of gate-001, which recorded PASS on unverified claims
- **Dependencies:** Auth BC (JwtAuthGuard, RolesGuard), FeatureGate config
- **Trigger:** Documentation audit found gate-001 evidence did not match repository state

## Why this rerun exists

gate-001 recorded `PASS` with "Implementation complete, build passes". Re-verification
on a clean install found the build broken and a functional defect in a shipped endpoint:

| gate-001 claim | Verified result |
|----------------|-----------------|
| build passes | FAILED — `create-catalog.use-case.ts` imports `uuid`, never declared in `package.json` |
| Catalog CRUD with tree structure complete | `GET /catalogs/:id` ignored its `:id` and returned the entire tree |

## Criteria
- [x] Domain entity + events created (Catalog, CatalogDeleted)
- [x] Use cases implemented (Create, Update, Archive, GetTree)
- [x] `GET /catalogs/:id` returns a single catalog (fixed in PR #1)
- [x] Controller wired with @Gate('productCatalog') + JwtAuthGuard + RolesGuard
- [x] Build passes (fixed in PR #1 — 0 errors)
- [x] Feature flag env var defined = FEATURE_PRODUCT_CATALOG
- [ ] Unit tests — none exist for this context
- [ ] Application bootstraps — blocked outside this context, see below

## Decision
RERUN
**Reason:** The defects owned by this context are fixed and verified, but the context has
zero test coverage, and the application cannot start because of a blocker in `UserModule`.
Enabling `FEATURE_PRODUCT_CATALOG` has no effect while the process fails to boot.

## Evaluation Result

### Outcome
**Gate decision:** RERUN
**Action:** Add unit tests for the catalog use cases; rerun once the bootstrap blocker
(tracked in `docs/gates/user/gate-002--rerun.md`) is resolved.

### Defect fixed since gate-001

`GET /catalogs/:id` accepted an `:id` parameter, discarded it, and called
`GetCatalogTreeUseCase.execute()` — every request returned the whole catalog tree
regardless of the id. The unused parameter was masked by a standing lint error.

PR #1 added `GetCatalogUseCase` using the `findById` the repository port already exposed,
and wired it through the controller and module. Unknown ids now raise `NotFoundError`,
which `GlobalExceptionFilter` maps to 404.

### Evidence
- Build: 0 errors (after PR #1)
- Tests: 0 spec files in this context — the 16 passing tests belong to auth, user, and app
- Lint: 0 non-formatting errors (after PR #1)
- Bootstrap: FAILS — cause is in `UserModule`, not this context
- Endpoints: 5/5 carry `@Gate('productCatalog')`; writes additionally carry `@Roles('admin')`

### Issues Found
1. **No test coverage.** This context has no `*.spec.ts` at all. The `:id` defect would
   have been caught by one test asserting the route returns a single catalog.
2. `update-catalog.use-case.ts:13` throws a bare `new Error('Catalog not found')`.
   `GlobalExceptionFilter` maps only `DomainError` subclasses by name, so updating a
   missing catalog returns **500 instead of 404**. `GetCatalogUseCase` (added in PR #1)
   uses `NotFoundError` correctly and can serve as the pattern.
3. `archive-catalog.use-case.ts` imports `NotFoundException` from `@nestjs/common`.
   Per CLAUDE.md the application layer should depend on the `Injectable` decorator only;
   framework HTTP exceptions belong in adapters, with domain/application errors used inward.

### Next Step
Add unit tests covering Create/Update/Archive/GetTree/GetCatalog, convert the bare `Error`
to `NotFoundError`, then rerun as gate-003 once the application boots.
