# Gate: product

## Gate Run: 002
**Date:** 2026-08-06
**Feature:** product (Product Context — Phase 2B)
**Gate Type:** rerun

## Decision Context
- **Feature:** Product CRUD, search, attributes, media management
- **Status:** Re-audit of gate-001, which recorded PASS on unverified claims
- **Dependencies:** Catalog BC (CatalogDeleted event), Auth BC, FeatureGate config
- **Trigger:** Documentation audit found gate-001 evidence did not match repository state

## Why this rerun exists

gate-001 recorded `PASS` with "Implementation complete, build passes". Re-verification on
a clean install found the build broken and a violation of the project's central
architecture rule:

| gate-001 claim | Verified result |
|----------------|-----------------|
| build passes | FAILED — `product.entity.ts` and `create-product.use-case.ts` import `uuid`, never declared |
| DDD Hexagonal structure conformant | `product/domain/entities/product.entity.ts` imported `uuid` — CLAUDE.md names `uuid` explicitly as forbidden in the domain layer |

## Criteria
- [x] Domain entities created (Product, ProductAttribute, ProductMedia)
- [x] Use cases implemented (10 — CRUD, publish, archive, search, attributes, media)
- [x] Cross-context handler (CatalogDeleted → archive products)
- [x] Domain layer is pure TypeScript (fixed in PR #1)
- [x] Controller wired with @Gate('productCatalog') + JwtAuthGuard
- [x] Build passes (fixed in PR #1 — 0 errors)
- [x] Feature flag env var defined = FEATURE_PRODUCT_CATALOG
- [ ] Unit tests — none exist for this context
- [ ] `ProductPublished` written to outbox — no outbox exists (Phase 2 DoD)
- [ ] Application bootstraps — blocked outside this context, see below

## Decision
RERUN
**Reason:** The domain-purity violation is fixed, but the context has zero test coverage,
the Phase 2 Definition of Done requires an outbox that does not exist, and the application
cannot start because of a blocker in `UserModule`.

## Evaluation Result

### Outcome
**Gate decision:** RERUN
**Action:** Add unit tests and implement the outbox; rerun once the bootstrap blocker
(tracked in `docs/gates/user/gate-002--rerun.md`) is resolved.

### Architecture violation fixed since gate-001

`product/domain/entities/product.entity.ts` imported `v4 as uuidv4` from `uuid` and called
it inside `addAttribute()` and `addMedia()`. CLAUDE.md's golden rule states the domain
layer must have zero imports from any package and names `uuid` as an example. gate-001
recorded "DDD Hexagonal structure ✅" without catching it.

PR #1 removed the import and moved id generation to the calling use cases; `addAttribute()`
and `addMedia()` now take the id as their first argument. The domain layer is now free of
package imports — verified across `src/modules/*/domain/` and `src/shared/domain/`.

### Evidence
- Build: 0 errors (after PR #1)
- Tests: 0 spec files in this context — the 16 passing tests belong to auth, user, and app
- Lint: 0 non-formatting errors (after PR #1)
- Bootstrap: FAILS — cause is in `UserModule`, not this context
- Endpoints: 10/10 carry `@Gate('productCatalog')`
- Domain purity: verified clean

### Issues Found
1. **No test coverage.** 23 files, 10 use cases, a cross-context event handler, and no
   `*.spec.ts`. The `CatalogDeleted` handler in particular is untested cross-BC behaviour.
2. **Outbox missing.** The Phase 2 Definition of Done in the roadmap requires
   "ProductPublished event is written to outbox". `grep -rn outbox src/` returns nothing.
   `publish-product.use-case.ts` changes status without emitting a durable event.
3. `product.controller.ts:43` throws a bare `new Error('Unauthorized')` when no userId is
   present on the request. `GlobalExceptionFilter` maps only `DomainError` subclasses by
   name, so a missing identity returns **500 instead of 401**.
4. Eight use cases import `NotFoundException` from `@nestjs/common`. Per CLAUDE.md the
   application layer should depend on the `Injectable` decorator only.

### Next Step
Add unit tests for the use cases and the `CatalogDeleted` handler, decide whether the
outbox lands in this phase or moves to a dedicated slice, then rerun as gate-003 once the
application boots.
