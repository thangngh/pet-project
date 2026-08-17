# spec-001 — Serve an authenticated request

**Implements** D1, D2, D3, D4, D13 from `docs/decision.md`
**Closes** F01, F02, F03, F04, F10, F16, F19, F21 from `docs/audit/audit-2026-08-17.md`
**Depends on** PR #3 being merged (the container must resolve before anything here can boot)

## Goal

Make one real request work end to end, on a real database, proved by a test
that runs in CI:

```
POST /auth/register  →  POST /auth/login  →  GET …/me  →  200 with the profile
```

Today every step of that fails for a different reason. That single chain
exercises registration, the event flow repaired in PR #3, JWT issuing, identity
propagation, validation and persistence — which is why it is the goal rather
than a list of fixes.

## Definition of done

- [ ] `docker compose up -d && pnpm migration:run && pnpm start:dev` produces a
      running API against a real database, from a clean clone
- [ ] The chain above returns 200 with the profile created by the
      `UserCreated` handler
- [ ] `GET …/products` with no query string returns page 1 with 20 items, not
      a `NaN` failure
- [ ] `POST /auth/register` with `{"password": "a"}` returns 400, not 201
- [ ] CI runs build, lint, unit tests, migrations and e2e on every pull request
- [ ] `pnpm lint` no longer rewrites files

## Scope

**In:** identity propagation, global validation, migrations, database
alignment, CI, formatting baseline, lockfile.

**Out, deliberately:** RBAC and the role field (spec-002 — F05 must not be
touched before F20), refresh tokens (spec-002), the gate 503 (spec-002),
outbox and subtree cascade (spec-003), route prefixes and documentation
(spec-004). The endpoint paths in this spec keep their current double prefix;
fixing that is D11 and needs your answer first.

## Assumption — one database

Written against **D4 option A**: one PostgreSQL service, one database. If you
rule for three data sources, only §4 changes; §§1–3 and 5–7 are unaffected.

---

## 1. Identity reaches `RequestContext` (D1 → F01)

### Change

`modules/auth/adapters/outbound/auth/jwt-auth.guard.ts` gains
`RequestContextService` and writes the identity once Passport has validated it:

```ts
handleRequest<TUser = any>(err: any, user: any): TUser {
  if (err || !user) {
    throw err || new UnauthorizedException('Invalid or expired token');
  }

  this.requestContext.setIdentity({
    userId: user.id,
    roles: user.role ? [user.role] : [],
    authMethod: 'jwt',
  });

  return user;
}
```

`handleRequest` runs inside the async context opened by
`RequestContextMiddleware`, so the write lands in the store the application
layer later reads. `AuthModule` imports `RequestContextModule`.

### Why here and not in the middleware

The middleware runs before guards and cannot tell an authenticated route from a
`@Public()` one; the guard is the only component that knows both. Putting token
parsing in the middleware would mean two places verify JWTs.

### Verification

- Unit: a guard test asserting `setIdentity` is called with the mapped identity,
  and that `@Public()` routes still pass without one.
- The e2e chain in §6 is the real proof — `GET …/me` cannot return 200 unless
  this works.

---

## 2. Global validation (D2 → F02, F10)

### Change

Register Nest's built-in pipe as a provider in `app.module.ts`:

```ts
{
  provide: APP_PIPE,
  useValue: new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
}
```

Delete `shared/application/pipes/validation.pipe.ts` — a strict subset of the
built-in pipe.

`APP_PIPE` rather than `useGlobalPipes` so `app.bootstrap.spec.ts` covers the
registration; a pipe added in `main.ts` is invisible to every test.

### Blast radius to expect

This is the change most likely to break something silently working. Every
endpoint starts validating at once:

| Endpoint | New behaviour |
|---|---|
| `POST /auth/register` | Weak password or bad email → 400 |
| `POST /auth/login` | Missing field → 400 |
| `PATCH …/me/profile` | Unknown field → 400 (`forbidNonWhitelisted`) |
| `GET …/products` | `page`/`limit` default and coerce → F10 fixed |
| all writes | Unknown properties stripped |

`RegisterDto.role` survives this step — `whitelist` keeps declared fields.
Removing it is D5, in spec-002.

### Verification

- Unit: DTO validation specs for `RegisterDto` and `SearchProductDto`
  (defaults applied, strings coerced to numbers).
- e2e: register with `{"password": "a"}` → 400; `GET …/products` with no query
  → 200 and `page: 1, limit: 20`.

---

## 3. Migrations (D3 → F03)

### Changes

1. `backend/src/data-source.ts` — a `DataSource` for the TypeORM CLI, reading
   the same env vars as `typeorm.module.ts`, with
   `entities: ['src/**/*.entity.ts']` and `migrations: ['src/migrations/*.ts']`.
2. `backend/src/migrations/<timestamp>-InitialSchema.ts` — generated, then read
   before committing. It must create the five existing tables:
   `users`, `user_profiles`, `user_sessions`, `catalogs`, `products`.
3. `package.json` scripts:

```json
"migration:generate": "typeorm-ts-node-commonjs migration:generate -d src/data-source.ts",
"migration:run":      "typeorm-ts-node-commonjs migration:run -d src/data-source.ts",
"migration:revert":   "typeorm-ts-node-commonjs migration:revert -d src/data-source.ts"
```

4. `typeorm.module.ts`: add `migrations`, keep `migrationsRun: false` (running
   migrations is an explicit step, not a side effect of boot), and drop the
   `entities` glob — it points at `*.entity.ts` paths that do not exist in
   `dist/`, and `autoLoadEntities: true` is what actually resolves entities
   today. Removing dead configuration that appears to work is worth the two
   lines it costs.

`synchronize` stays false everywhere.

### Verification

- `pnpm migration:run` against a clean database creates all five tables.
- `pnpm migration:revert` drops them.
- CI runs the migration before the e2e suite, so a missing migration for a new
  entity fails the build rather than the deploy.

---

## 4. Database alignment (D4 → F04)

*This is the section that changes if you rule against D4's recommendation.*

### Changes

1. `docker-compose.yml`: replace `postgres_auth`, `postgres_user` and
   `postgres_catalog` with one `postgres` service on 5432 serving
   `${DB_DATABASE:-ddd_project}`, one volume, same healthcheck.
2. `app.config.ts`: delete the unread `database.auth` and `database.user`
   blocks.
3. `.env.example` and `.env`: delete the `DB_AUTH_*`, `DB_USER_*` and
   `DB_CATALOG_*` groups.

Deferred: schema-per-context. It buys visible boundaries but complicates every
migration now, and buys nothing until a context is extracted. Recorded in D4,
not built here.

### Verification

`docker compose up -d` then `pnpm migration:run` then `pnpm start:dev` from a
clean clone, following only `CLAUDE.md`. That path is currently broken at three
separate points; the acceptance is that it works with no undocumented steps.

---

## 5. CI and hygiene (D13 → F16, F19, F21)

### Changes

1. `.github/workflows/ci.yml`, on pull request and push to `main`:

```
services: postgres:16 (5432, ddd_project)
steps:
  pnpm install --frozen-lockfile
  pnpm build
  pnpm lint            # check only, see below
  pnpm test
  pnpm migration:run
  pnpm test:e2e
```

2. `package.json`: `"lint": "eslint \"{src,apps,libs,test}/**/*.ts\""` (no
   `--fix`), plus `"lint:fix"` keeping the old behaviour. Today the documented
   lint command rewrites 48 files, so anyone who lints produces an unreviewable
   diff.
3. One mechanical commit applying `lint:fix` across the repository, alone, so
   the 146 formatting errors never again hide inside a review. **This commit
   must contain nothing else.**
4. Delete `backend/package-lock.json`; keep `pnpm-lock.yaml`.

### Why CI is in this slice rather than later

Every figure in every gate artifact so far comes from a local run by whoever
wrote it. That is the mechanism by which the record drifted from the system.
The audit is worth little if the next claim is again unverifiable.

---

## 6. The e2e proof (the goal)

`backend/test/auth-profile.e2e-spec.ts`, against the CI PostgreSQL service:

```
1. POST /api/auth/register  { email, password: "Str0ngPass" }   → 201, tokens
2. the UserCreated handler has created a profile                 → assert row exists
3. POST /api/auth/login                                          → 200, tokens
4. GET  /api/api/v1/me   with the access token                   → 200, profile
5. GET  /api/api/v1/me   with no token                           → 401
6. POST /api/auth/register { password: "a" }                     → 400
7. GET  /api/api/v1/products                                     → 200, page 1, limit 20
```

The paths in steps 4 and 7 carry the double prefix from F12 on purpose: this
spec proves the system as it is. D11 changes them, and this file changes with
it.

Step 2 is the first end-to-end proof of the `UserCreated` flow. PR #3 proved
delivery through the bus with a stubbed repository; this proves it against a
database.

Also update `backend/test/app.e2e-spec.ts`, currently the Nest scaffold's
`GET /` check against a route that the global prefix has since moved.

---

## 7. Task order

Each task ends green — build, tests, and the checks named.

| # | Task | Verified by |
|---|------|-------------|
| 1 | Delete `package-lock.json`; `lint` stops fixing; add `lint:fix` | `pnpm lint` reports without writing |
| 2 | Formatting commit, alone | `pnpm lint` → 0 errors |
| 3 | Collapse compose to one database; drop unread config (§4) | `docker compose up -d` healthy |
| 4 | `data-source.ts`, initial migration, scripts (§3) | `migration:run` then `revert` on a clean database |
| 5 | Identity in `JwtAuthGuard` (§1) | Guard unit test |
| 6 | Global `ValidationPipe`; delete the custom pipe (§2) | DTO unit tests; `app.bootstrap.spec.ts` still resolves |
| 7 | e2e suite (§6) | The seven assertions |
| 8 | CI workflow (§5) | The workflow passes on its own pull request |

Order matters in two places: 2 before everything else so no later diff carries
formatting noise, and 4 before 7 because the e2e suite needs a schema.

## Risks

| Risk | Likelihood | Handling |
|---|---|---|
| Global validation rejects a request that works today | **high — by design** | Task 7's e2e lands with task 6, not after |
| `forbidNonWhitelisted` is stricter than a client expects | medium | Named in D2; drop to `whitelist` alone if it bites |
| Generated migration does not match hand-written entity intent | medium | Read the generated SQL before committing; never commit a generated migration unread |
| Compose change wipes local data | low | Volumes are renamed, not reused; `docker compose down -v` first |
| Identity mapping wrong for a future API-key path | low | `authMethod` is explicit; D12 removes the unbuilt API-key port |

## Rollback

Tasks 1–4 are additive or configuration-only and revert cleanly. Task 6 is the
only one that changes behaviour for existing callers; reverting the `APP_PIPE`
provider restores the previous behaviour exactly, since nothing else depends on
validation running.

## Gate

On completion, `docs/gates/shared/gate-001--serve-a-request.md`:

- Criteria: the six Definition of Done items
- Evidence: CI run URL, the e2e assertions, the migration up/down output
- Any unmet item recorded as an issue, not omitted

Evidence comes from the CI run, not a local one. That is the point of §5.
