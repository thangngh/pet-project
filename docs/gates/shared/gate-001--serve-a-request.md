# Gate: serve-an-authenticated-request

## Gate Run: 001

**Date:** 2026-08-17
**Feature:** spec-001 — serve an authenticated request
**Gate Type:** create

## Decision Context

- **Feature:** Make one real request work end to end on a real database:
  `POST /auth/register → POST /auth/login → GET /me → 200`
- **Status:** Implemented; verified against PostgreSQL 16
- **Dependencies:** PR #3 (container resolves), D1–D4, D11, D13, D15
- **Spec:** `docs/specs/spec-001-serve-an-authenticated-request.md`

## Criteria

- [x] One connection pool and one schema per bounded context
- [x] Four independent migration histories
- [x] The register → login → `/me` chain returns 200 with the profile
- [x] `GET /products/search` with no query string returns 200, not a `NaN` failure
- [x] `POST /auth/register` with `{"password": "a"}` returns 400
- [x] `pnpm lint` reports without rewriting
- [x] One lockfile
- [x] CI workflow runs build, lint, unit tests, migrations and e2e
- [ ] CI has actually run on a pull request
- [ ] `docker compose up -d` verified

## Decision

**PASS, with two criteria unverified and named below.**

**Reason:** every behavioural criterion was exercised against a running
PostgreSQL 16 instance rather than asserted. The two unmet items are
environmental, not defects, and both are stated rather than omitted.

---

## Evaluation Result

### Outcome

**Gate decision:** PASS
**Action:** proceed to spec-002, once CI has run green on the pull request

### Evidence

All figures below come from commands run in this session against a real
PostgreSQL 16 instance and a clean `ddd_project` database.

**The chain (§6), against a running instance:**

| Step | Result |
|---|---|
| `POST /api/v1/auth/register` | 201 with both tokens |
| profile created by the `UserCreated` handler | row in `user.user_profiles`, `status = active` |
| `POST /api/v1/auth/login` | 200 |
| `GET /api/v1/me` with the token | 200, correct profile |
| `GET /api/v1/me` with no token | 401 |
| `POST /api/v1/auth/register`, password `"a"` | 400 |
| `GET /api/v1/products/search`, no query | 200 |
| `GET /health` | 200, unprefixed |

**Migrations (§3):**

- `pnpm migration:run` → 4 schemas, 5 tables, 4 independent `migrations` tables
- `pnpm migration:revert --context catalog` → `catalog.catalogs` dropped, the
  other three schemas untouched. This is the check that the histories are
  genuinely independent, and it passed.
- `pnpm migration:generate` for all four contexts → *"No changes in database
  schema were found"*, so the hand-written migrations match the entities
  exactly.

**Pools (§4):** `pg_stat_activity` grouped by `application_name` showed
`pet-auth`, `pet-user`, `pet-catalog`, `pet-product` — four distinct pools.

**The seam is real (§4.5), the criterion that mattered most:** with a second
database created and `DB_CATALOG_DATABASE=ddd_catalog` set — no code change,
no rebuild:

```
pet-catalog  → ddd_catalog
pet-auth     → ddd_project
pet-user     → ddd_project
pet-product  → ddd_project
```

and `/catalogs/tree`, `/me` and `/products/search` all answered 200 with the
contexts sitting in different databases.

**Suites:** 79 unit tests (16 suites), 11 e2e tests (2 suites), build clean,
`pnpm lint` clean.

### Issues Found

**1. A defect the audit had not found: every `UserCreated` event was being
discarded.**

`UserRepository.save()` called `user.clearEvents()`, so by the time
`AuthService.register` reached `publishEvents(user.events)` the array was
empty. Registration returned 201 and no profile was ever created.

PR #3's integration test could not have caught it: that test published through
the bus with a *stubbed* repository — the exact component doing the
discarding. Only a real database exposed it. `user.repository.spec.ts` now
asserts the invariant directly.

This is the same shape as the findings that prompted the audit: a component
that compiles, is named correctly, and is connected to nothing.

**2. A trap I wrote and then walked into.** The catalog migration warns that a
hand-added foreign key would be dropped by the next generated migration. I
then added indexes to all four migrations without declaring them on the
entities — the same mistake. `migration:generate` caught it; the entities now
declare them with matching names.

**3. `.env.example` would have split the contexts on the first boot.** It
shipped `DB_AUTH_PORT=5432`, `DB_USER_PORT=5433` and `DB_CATALOG_PORT=5434`
already set. Harmless before this slice, because nothing read them; under the
new fallback chain they would have pointed three contexts at ports the
single-postgres compose does not serve. Now commented examples.

**4. `products/search` requires authentication.** spec-001 assumed it was
public and asserted a plain 200. It returns 401 without a token and 200 with
one. The spec's assumption was wrong, not the code; the e2e asserts the real
behaviour.

### Unverified — stated, not omitted

- **`docker compose up -d` was never run.** No Docker daemon is available in
  this environment. Everything above used a locally installed PostgreSQL 16
  against the same `ddd_project` database the compose file serves, so the
  application path is identical, but the compose file itself is unexercised.
  First person with Docker should run it and record the result here.
- **The CI workflow has never run.** The full sequence — build, lint, test,
  `migration:run`, `test:e2e` — was run locally in the workflow's order
  against a clean database and passed. That is not the same as GitHub Actions
  having run it, and this gate does not claim it has.

### Next Step

CI runs on the pull request. When it is green, its run URL replaces the local
figures above and the two unchecked criteria close. Then spec-002 — whose
first task, the role vocabulary, must land before `FEATURE_RBAC=true`, or
`@Roles` denies everyone.
