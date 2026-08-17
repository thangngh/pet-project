# Decisions — 2026-08-17

Decisions taken in response to `docs/audit/audit-2026-08-17.md`. Each one names
the findings it closes, the options considered, and what it costs.

**Status values.** `proposed` — my recommendation, not yet yours. `accepted` —
you have confirmed it, or it is small and reversible enough that I proceed and
you can reverse it cheaply. Nothing here is implemented yet; the specs come
after.

## Index

| ID | Decision | Closes | Status | Reversible |
|----|----------|--------|--------|------------|
| D1 | Copy identity into `RequestContext` from the JWT guard | F01 | proposed | yes |
| D2 | Register Nest's built-in `ValidationPipe` globally; delete the custom one | F02, F10 | proposed | yes |
| D3 | TypeORM migrations, never `synchronize` outside tests | F03 | proposed | yes |
| D4 | One database, not three | F04 | **needs your call** | costly |
| D5 | Remove `role` from public registration before enabling RBAC | F20, F05 | proposed | yes |
| D6 | Enforce password strength in the value object, not only the DTO | F06, F15 | proposed | yes |
| D7 | `GateException` extends `HttpException` with 503 | F07 | accepted | yes |
| D8 | Refresh tokens: persist and rotate, using the `UserSession` that already exists | F08 | proposed | yes |
| D9 | Archive cascades to the catalog subtree, one event per catalog | F09 | proposed | yes |
| D10 | Adopt a transactional outbox — but not yet | F11 | proposed | costly |
| D11 | Single global prefix `api/v1`; strip it from controllers | F12 | **needs your call** | breaking |
| D12 | Delete `AUTH_MIDDLEWARE_PORT`; document the real mechanism | F13, F17 | proposed | yes |
| D13 | Add CI, and stop `pnpm lint` from rewriting files | F16, F19 | accepted | yes |
| D14 | Correct the records rather than re-deriving them | F14, F17, F18 | accepted | yes |

---

## D1 — Copy identity into `RequestContext` from the JWT guard

**Closes** F01. **Status** proposed.

### Context

`setIdentity()` is never called, so four endpoints reject every caller. The
identity already exists on `req.user` by the time any handler runs; it just
never reaches the AsyncLocalStorage store the application layer reads.

### Options

| | Approach | Cost | Problem |
|---|---|---|---|
| A | Middleware decodes the JWT itself | medium | Two places verify tokens; they will drift |
| B | `JwtAuthGuard` writes `req.user` into the context after Passport validates | small | None found |
| C | Build `IAuthMiddlewarePort` as `CLAUDE.md` describes, with a global `AuthGuard` | large | Also drags in API keys, which nothing needs yet |

### Decision

**B.** `JwtAuthGuard` already sits on the one path where identity becomes known
and is the only component that can distinguish `@Public()` from authenticated.
It runs inside the async context the middleware opened, so `setIdentity()` from
there lands in the right store.

### Why not C

C is what the documentation promises, and it would also close F13. But it
bundles an API-key mechanism that has no consumer, and it converts a four-line
fix into a re-architecture of the request path — while the API is still unusable
for other reasons. D12 settles the documentation side instead: correct the
document to describe what the system does.

### Consequences

- Four dead endpoints become reachable — the first time the User bounded
  context works at all.
- `RequestIdentity` is `{ userId, roles, authMethod, attributes? }`. The JWT
  carries `sub`, `email` and a single `role`, so the mapping is
  `userId: sub`, `roles: [role]`, `authMethod: 'jwt'`. `attributes` stays
  undefined until something populates it — `AttributesGuard` is its only reader
  and it tolerates the absence.
- Guards keep reading `req.user`; nothing regresses.

---

## D2 — Register Nest's built-in `ValidationPipe` globally

**Closes** F02, and F10 through it. **Status** proposed.

### Options

| | Approach | Gains |
|---|---|---|
| A | Register the repository's custom pipe | Validation + transform |
| B | Nest's built-in via `APP_PIPE`, delete the custom pipe | Also `whitelist`, `forbidNonWhitelisted`, `transformOptions` |

### Decision

**B**, configured `{ transform: true, whitelist: true, forbidNonWhitelisted: true }`.

The custom pipe is a strict subset of the built-in one and one more thing to
maintain. `whitelist` matters here specifically: it strips properties with no
decorator, which is the second line of defence against D5's class of bug —
a client sending a field the DTO never declared.

Registering it as `APP_PIPE` rather than `useGlobalPipes` keeps it inside the
DI container, so `app.bootstrap.spec.ts` covers it.

### Consequences

- **This will start rejecting requests that today succeed.** That is the
  intent, but it is a behaviour change on every endpoint at once. It needs the
  e2e coverage from spec-001 landing in the same change, not after.
- `SearchProductDto`'s defaults and `@Type(() => Number)` begin working, so
  F10's `NaN` disappears without touching the repository.
- `forbidNonWhitelisted` means an unknown field is a 400 rather than being
  ignored. Stricter than most clients expect — worth confirming, but the safer
  default while the surface is small.

---

## D3 — TypeORM migrations, never `synchronize` outside tests

**Closes** F03. **Status** proposed.

### Options

A. `DB_SYNCHRONIZE=true` in development. Fast, and silently destructive —
it will drop columns to match entities. Fine for a scratch database, wrong as
the documented path.

B. Migrations checked into the repository, generated from the entities, with a
`data-source.ts` and `migration:generate` / `migration:run` / `migration:revert`
scripts.

### Decision

**B.** One initial migration covering the five existing tables. `synchronize`
stays false everywhere except an in-memory or throwaway test database.

The roadmap already assumes migrations exist — Phase 1's DoD names outbox and
idempotency table migrations specifically — so this is the mechanism the plan
was written against.

### Consequences

- Unblocks every "not verified against a live database" note carried since
  2026-08-06.
- Adds a step contributors must not forget: an entity change without a
  migration will pass tests and fail on deploy. D13's CI is where that gets
  caught, by running migrations before the tests.

---

## D4 — One database, not three — **needs your call**

**Closes** F04. **Status** needs your decision.

### Context

Compose starts `postgres_auth`, `postgres_user` and `postgres_catalog` on three
ports. The application opens exactly one `DataSource` and points it at a fourth
database name that no service creates. `app.config.ts` carries per-context
blocks nothing reads.

Somebody intended database-per-context. The code went the other way. Neither
half is wrong on its own; they simply do not describe the same system.

### Options

| | Approach | Cost | Consequence |
|---|---|---|---|
| A | One `postgres` service, one database | small | Contexts share a schema. Cross-context joins become possible — and nothing stops someone writing one |
| B | Three data sources, one per context | large | Every module wires its own connection; no cross-context transaction; the outbox needs one table per database |

### Recommendation

**A**, for now. The system is a monolith with four contexts, no context has been
extracted, and B's main benefit — independent deployment and scaling — cannot be
collected until one is. B also multiplies D10's outbox work by three.

The isolation B protects can be kept cheaply under A by keeping each context's
tables in its own PostgreSQL schema, so the boundary is visible and a later
split is a schema move rather than a rewrite.

### Why this needs you

It is the one decision here that is expensive to reverse and reflects intent I
cannot read from the code. The compose file says someone wanted separation. If
that is a near-term goal, say so and I will spec B instead.

---

## D5 — Remove `role` from public registration, before enabling RBAC

**Closes** F20, and unblocks F05. **Status** proposed.

### Context

`POST /auth/register` is public and accepts `role: "admin"`, which reaches
`User.create` unchecked. Today it is harmless only because RBAC is off — which
means the obvious fix, turning RBAC on, is the one thing that must not happen
first.

### Decision

Three changes, in this order:

1. Drop `role` from `RegisterDto` and `RegisterUserInput`. Public registration
   always produces a `user`.
2. Add `@IsIn(['admin', 'user'])` wherever a role is accepted from input in
   future, so the compile-time union has a runtime counterpart.
3. Only then set `FEATURE_RBAC=true`.

Promoting a user to admin becomes an admin-only operation or a seeded account —
spec-002 decides which. Until then, the first admin is created by a seed.

### Consequences

- No client can choose its own role. If something in your workflow relies on
  registering an admin through the public endpoint, it breaks — tell me and the
  seed lands first.
- Enabling RBAC makes eleven endpoints genuinely admin-only. Any existing caller
  without an admin role starts getting 403. This is the change most likely to
  surprise, which is why it is spec-002 and not spec-001.

---

## D6 — Enforce password strength in the value object

**Closes** F06, F15. **Status** proposed.

### Context

Strength is checked in two places and enforced in neither: the DTO rules never
run (F02), and the value object skips validation whenever `hashed` is true —
which both call sites pass.

D2 alone would restore the DTO half. That is not enough: the DTO is a
presentation concern, and `AuthService` can construct a `User` without one.

### Decision

Validate the plaintext in the value object before hashing, by constructing
`new Password(plaintext)` — which runs the rule — and hashing after. Keep the
DTO rules too, so a bad request fails at the boundary with a good message
rather than deep in the service.

Two independent checks is the right amount here, because the two ways in are
genuinely different: HTTP, and any future internal caller.

### Consequences

- `Password`'s `hashed` flag keeps its meaning for rehydration from the
  database, where the value really is a hash and must not be re-validated.
- Existing stored passwords are unaffected.

---

## D7 — `GateException` extends `HttpException` with 503

**Closes** F07. **Status** accepted — small and reversible.

`GateException extends Error`, so the global filter's fallback branch returns
500 "Internal server error". A disabled feature and a crash are indistinguishable
to a client, and maintenance mode (`API_LOCKED=true`) presents the whole API as
broken.

It becomes an `HttpException` carrying 503 and a body of
`{ code: 'FEATURE_DISABLED', feature }`, which is what `CLAUDE.md` already
promises. The filter needs no change — its `HttpException` branch handles it.

---

## D8 — Refresh tokens: persist and rotate

**Closes** F08. **Status** proposed.

### Context

A refresh token is issued and can never be used: no endpoint, no storage, no
rotation, no revocation. `UserSession` — entity, repository, DI token — is
wired into `UserModule` and injected by nothing. It is the store this needs.

### Decision

`POST /auth/refresh` accepts a refresh token, verifies it against a stored
`UserSession`, issues a new pair and invalidates the old session — rotation, so
a replayed refresh token is rejected and detectable.

Store a hash of the token, not the token. It is a credential; the argument for
hashing it is the argument for hashing passwords.

### Consequences

- Logout becomes possible for the first time — deleting the session.
- Sessions become inspectable, which is what makes revocation possible.
- Costs a database read per refresh. At a 15-minute access-token lifetime that
  is negligible.

---

## D9 — Archive cascades to the catalog subtree

**Closes** F09. **Status** proposed.

### Context

Archiving a catalog archives products whose `catalogId` matches, one level
deep. Child catalogs and everything under them stay active. Catalogs are a
tree, so one level is a defect rather than a deliberate limit.

### Options

| | Where the tree is walked | Verdict |
|---|---|---|
| A | Catalog context resolves descendants, archives each, emits one event per catalog | Correct — the tree belongs to Catalog |
| B | Product context resolves descendants | Wrong — Product would need the catalog tree |
| C | The event carries the whole id list | Couples consumers to the producer's tree shape |

### Decision

**A.** `ArchiveCatalogUseCase` loads the subtree, archives each catalog, and
publishes one `CatalogDeletedEvent` per archived catalog. Consumers stay as they
are — one event, one catalog id — and the Product context learns nothing about
trees.

### Consequences

- Archiving a large subtree emits many events. In process that is fine; under
  D10's outbox it is many rows, which is correct but worth knowing.
- Needs `findDescendants` on the catalog port. A recursive CTE in the adapter,
  or repeated `findChildren` calls — the port stays the same either way.
- The idempotence added in PR #3 (a second archive publishes nothing) keeps
  partial re-runs safe.

---

## D10 — Adopt a transactional outbox, but not yet

**Closes** F11. **Status** proposed, sequenced last.

### Context

Both cross-context flows publish in process. If the process dies between the
database write and the handler, nothing retries and nothing records that the
event was owed: products stay active under an archived catalog, an account
exists with no profile.

The roadmap has asked for this since Phase 1.

### Decision

Adopt it — the pattern is right and the roadmap already assumes it. **Sequence
it after the P0 and P1 work**, for a reason worth stating plainly: an outbox is
a durability mechanism for a system that runs. Until D1–D4 land, there is no
running system to make durable, and no way to test that the outbox works.

Shape, to be specified properly in its own spec once D4 is settled:

- `outbox_messages` written in the same transaction as the aggregate
- a poller publishes to the existing bus and marks messages dispatched
- consumers made idempotent — an inbox table, or naturally idempotent handlers
  (`archiveByCatalogId` already is; profile creation is not)

### Why it is not first

Sequencing it before the P0 chain would produce a durable delivery mechanism
for endpoints that return 401, verified by no test, on a database that cannot
be created. That is how the current gate history came to overstate the system.

---

## D11 — Single global prefix `api/v1` — **needs your call**

**Closes** F12. **Status** needs your decision.

Routes are double-prefixed today: `/api/api/v1/products` for three controllers,
`/api/auth/...` for the fourth. No client can be written against the documented
API.

### Options

| | Result | Breaks |
|---|---|---|
| A | `setGlobalPrefix('api/v1')`, strip prefixes from controllers → `/api/v1/...` uniformly | Auth's current paths move from `/api/auth` to `/api/v1/auth` |
| B | Drop the global prefix, keep controller prefixes | Auth still differs; versioning stays per-controller |
| C | Nest's `enableVersioning` | Larger change; earns its keep only with two live versions |

### Recommendation

**A.** One place decides the prefix, everything is versioned consistently, and
`/api/v1` is what the interface documentation describes.

### Why this needs you

Every path changes. If anything already calls this API — a frontend branch, a
Postman collection, a deployed environment — those calls break at once. Cheap
to do, not cheap to undo once clients exist. Tell me whether anything is
calling it today.

---

## D12 — Delete `AUTH_MIDDLEWARE_PORT`, document the real mechanism

**Closes** F13, part of F17. **Status** proposed.

### Context

The port is declared, never implemented, never provided, never injected. It
survives only because `AttributesGuard` imports a type from the same file.
`CLAUDE.md` presents it as the mechanism by which every request is authenticated.

### Options

A. Implement it — a global `AuthGuard` delegating to the port, plus the
API-key half the interface promises.
B. Delete it, move `RequestIdentity` to the shared request-context types, and
correct `CLAUDE.md` to describe Passport and `JwtAuthGuard`.

### Decision

**B.** Nothing needs API keys: there is no worker, no scheduler, no CI caller.
Building the port to satisfy a document describes a system we have not decided
to have. When Phase 4 introduces workers, the port comes back with a consumer
to shape it — that is a better time to design it than now.

The document changes to match the code. That is the honest direction, given the
code is what runs.

### Consequences

- One fewer misleading abstraction. `RequestIdentity` moves next to the context
  that actually holds it, which is where a reader will look.
- `CLAUDE.md`'s per-context credential table ("Worker → API Key") becomes a plan
  rather than a description, and is marked as such.

---

## D13 — Add CI, and stop `pnpm lint` rewriting files

**Closes** F16, F19. **Status** accepted — small and reversible.

There is no CI. Every figure in every gate artifact comes from a local run by
whoever wrote it, which is exactly how the record drifted from reality. A
workflow runs install, build, lint (check only) and tests on every pull request,
with a PostgreSQL service so D3's migrations and the integration tests run too.

Separately: `lint` is defined as `eslint --fix`, so the documented lint command
rewrites about 48 files. It becomes a check; `lint:fix` keeps the rewriting
behaviour for whoever wants it. The 146 existing formatting errors get one
mechanical commit of their own, so they never again hide inside a review.

---

## D14 — Correct the records rather than re-deriving them

**Closes** F14, F17, F18. **Status** accepted.

`CLAUDE.md` describes module paths that do not exist, a `tenant/` adapter that
was never built, eight error classes that do not exist, a handling centre that
does not exist, and a 503 the code does not return. `MEMORY.md` is absent.
Two ledgers in `.superpowers/sdd/` describe finished work as pending. The
checkpoints and the roadmap disagree on what Phase 3 is.

Each is corrected in place, with the intended-versus-built distinction made
explicit rather than smoothed over — a document that describes aspirations as
facts is how three gate artifacts came to record "Issues Found: None" for
features that had never run.

The structural drift itself (Auth's missing `use-cases/`, the missing error
families) is recorded as intended-but-not-built, not fixed. Refactoring working
code to match a document is not worth doing while the API returns 401.

---

## Sequence

| Slice | Contains | Why here |
|-------|----------|----------|
| **spec-001** | D1, D2, D3, D4, D13 | Makes the application run and provable. Everything else depends on it |
| **spec-002** | D5, D6, D7, D8 | Auth and authorization hardening. F20 before F05, always |
| **spec-003** | D9, D10 | Durability and the cascade. Needs a database to be worth testing |
| **spec-004** | D11, D12, D14 | Surface and records. D11 waits on your answer |

Only spec-001 is written now. It proceeds on D4's recommendation — one database
— and isolates that assumption in a single section, so ruling the other way
changes that section and nothing else. spec-004 waits on D11 outright, because
there is no version of it that does not change every path.

## Open questions for you

1. **D4** — one database or three? I recommend one. Compose says someone wanted
   three.
2. **D11** — is anything calling this API today? If yes, the prefix fix needs a
   deprecation window rather than a rename.
3. **D5** — does anything you use register an admin through the public endpoint?
   If so, the seed lands before the field is removed.
