# Gate: auth-and-authorization-enforce

## Gate Run: 001

**Date:** 2026-08-17
**Feature:** spec-002 — auth and authorization actually enforce something
**Gate Type:** create

## Decision Context

- **Feature:** Turn on the authorization components that existed and were
  switched off — RBAC, password strength, gate 503, refresh tokens
- **Status:** Implemented; verified against PostgreSQL 16 and by CI
- **Dependencies:** spec-001 (a database to test against); D5, D6, D7, D8,
  D16, D17
- **Spec:** `docs/specs/spec-002-auth-and-authorization.md`

## Criteria

- [x] `@Roles(ROLE_ADMIN)` denies a non-admin on all eleven endpoints
- [x] An admin exists and can be created by a documented, authorised route
- [x] `POST /auth/register` with `"a"` returns 400 from the value object, not
      only the DTO
- [x] A disabled feature returns 503 with `code: "FEATURE_DISABLED"` and the
      feature name; `API_LOCKED=true` does the same for every endpoint
- [x] `POST /auth/refresh` rotates the pair; the old refresh token is rejected
- [x] `POST /auth/logout` makes the session's refresh token unusable
- [x] One role vocabulary in the codebase

## Decision

**PASS.**

**Reason:** every criterion was exercised end to end against a real database,
and the order the spec insisted on was followed — the vocabulary and the admin
seed both landed before `FEATURE_RBAC=true`.

---

## Evaluation Result

### Outcome

**Gate decision:** PASS
**Action:** proceed to spec-003 (durable delivery), the last piece with a
known correctness gap

### Evidence

**Vocabulary (§1).** `grep` finds no uppercase role literal; all eleven
`@Roles` call sites use `ROLE_ADMIN`; `UserRole` is derived from the constants
so a divergence fails to compile.

The proof that matters is negative: reverting `ROLE_ADMIN` to `'ADMIN'` left
the four original guard tests **green** and turned only the two new ones red.
The old tests compared `ROLE_ADMIN` against `ROLE_ADMIN` — self-consistent,
and blind to the only thing that mattered.

**RBAC (§4), all eleven endpoints enumerated, not sampled:**

| | non-admin | admin |
|---|---|---|
| `POST /catalogs` | 403 | 201 |
| `PATCH /catalogs/:id` | 403 | 404 |
| `DELETE /catalogs/:id` | 403 | 404 |
| `POST /products` | 403 | 201 |
| `PATCH /products/:id` | 403 | 404 |
| `POST /products/:id/publish` | 403 | 404 |
| `POST /products/:id/archive` | 403 | 404 |
| `POST /products/:id/attributes` | 403 | 404 |
| `DELETE /products/:id/attributes/:attrId` | 403 | 404 |
| `POST /products/:id/media` | 403 | 404 |
| `DELETE /products/:id/media/:mediaId` | 403 | 404 |

A 404 for an id that does not exist is the assertion: it means the handler
ran, which is what distinguishes passing the guard from being stopped by it.

**Admin bootstrap (§2).** `pnpm seed:admin` refuses a weak `ADMIN_PASSWORD`,
creates on first run, and reports "already present" and exits 0 on the second.
The promote endpoint refuses a non-admin (403) and a role outside the domain
vocabulary (400) — the runtime check the removed `RegisterDto.role` never had.
A promoted user passes the guard on a fresh token.

**Password strength (§3).** `AuthService.register` rejects a weak password
called directly, with no DTO involved — the case a DTO cannot cover.

**Gate 503 (§5).** A disabled feature returns 503 with `code:
"FEATURE_DISABLED"` and `feature: "productCatalog"`; `API_LOCKED=true` returns
503 with `code: "API_LOCKED"`; `/health` answers 200 in both states.

**Refresh (§6).** Stored value is a SHA-256 digest, never the token. A refresh
token presented as an access token is rejected. Rotation issues a new pair and
the old token stops working. Replaying a rotated token revokes every session
for that user, including an unrelated one. Logout makes its token unusable.

**Suites:** 113 unit tests (19 suites), 46 e2e tests (5 suites), build clean,
lint clean — the full CI sequence run locally in the workflow's order against
a freshly created database, and CI itself green on the preceding commit
(run 32009239875).

### Issues Found

**1. Two refresh tokens issued in the same second were byte-identical.**

The refresh payload was `{sub, type}`, and a JWT's `iat` has one-second
granularity, so a second refresh within the same second produced the same
string. The new session's hash then equalled the old one's, the lookup found
the wrong row, and rotation collapsed silently — the tokens still worked, so
nothing looked wrong.

Found by an e2e test that rotated twice quickly. The unit tests could not have
found it: they stub `jwtService.sign`. The session id now goes into the
payload, which makes each token unique by construction.

**2. My own test made a mistake worth recording.** The reuse-detection test
initially reused a token that an earlier test had already rotated — and the
earlier test's "old token is rejected" assertion *is* the compromise path, so
it had already revoked every session. The tests are now independent. The
behaviour was correct throughout; the test was wrong about the state it was
starting from.

**3. A defect in maintenance mode that the spec did not name.** `GateGuard` is
a global `APP_GUARD` and checked `isApiLocked()` before anything else, so
`API_LOCKED=true` made `/health` return 503. An orchestrator reading that as
"unhealthy" restarts the process that is deliberately in maintenance. Added
`@SkipGate()` for probes.

**4. A deviation from the spec, deliberate.** spec-002 §5 says `API_LOCKED`
returns the same `code: "FEATURE_DISABLED"`. It returns `code: "API_LOCKED"`
instead: "the whole API is down" and "this one feature is off" call for
different client behaviour, and the alternative was a `feature` field reading
`__api_locked__`. Both are 503 with a machine-readable code, which is what the
criterion was for.

### Not in this slice

`UserSession.rotate()` is now unused. Rotation revokes the old session and
creates a new one instead of overwriting the hash in place, because
overwriting erases the only evidence the old token existed — and with it the
ability to detect its reuse. The method is left in the domain entity rather
than deleted, pending a decision in spec-004's pass over dead code.

### Next Step

spec-003: the outbox and the subtree cascade. Both cross-context flows deliver
in process, which means they deliver *usually* — and under D4's per-context
pools there is no cross-context transaction available, so an outbox is not a
durability upgrade but the only correct way for two contexts to agree.
