# spec-001 — Serve an authenticated request

**Implements** D1, D2, D3, D4, D13 from `docs/decision.md`
**Closes** F01, F02, F03, F04, F10, F16, F19, F21 from `docs/audit/audit-2026-08-17.md`
**Depends on** PR #3 being merged (the container must resolve before anything here can boot)

## Goal

Make one real request work end to end, on a real database, proved by a test
that runs in CI:

```
POST /api/v1/auth/register → POST /api/v1/auth/login → GET /api/v1/me → 200 with the profile
```

Today every step of that fails for a different reason. That single chain
exercises registration, the event flow repaired in PR #3, JWT issuing, identity
propagation, validation and persistence — which is why it is the goal rather
than a list of fixes.

## Definition of done

- [ ] `docker compose up -d && pnpm migration:run && pnpm start:dev` produces a
      running API against a real database, from a clean clone
- [ ] Four connection pools, four schemas, four migration histories — and
      moving one context to its own database is a change of environment
      variables only
- [ ] The chain above returns 200 with the profile created by the
      `UserCreated` handler
- [ ] `GET /api/v1/products/search` with no query string returns page 1 with 20
      items, not a `NaN` failure
- [ ] `POST /api/v1/auth/register` with `{"password": "a"}` returns 400, not 201
- [ ] CI runs build, lint, unit tests, migrations and e2e on every pull request
- [ ] `pnpm lint` no longer rewrites files

## Scope

**In:** identity propagation, global validation, per-context pools and
migrations, database alignment, CI, formatting baseline, lockfile.

**Out, deliberately:** RBAC and the role field (spec-002 — F05 must not be
touched before F20), refresh tokens (spec-002), the gate 503 (spec-002),
outbox and subtree cascade (spec-003), documentation (spec-004).

**Already done, ahead of this spec:** D11's route prefix. Paths below are the
real ones — `/api/v1/...`, with `/health` excluded.

## Persistence shape (D4, ruled 2026-08-17)

One database now, **one connection pool per bounded context**, each context in
its own PostgreSQL schema with its own migration history. Database-per-context
is the destination; this slice builds the seam so that getting there is a
change of environment variables, not of code.

That ruling touches §3 and §4 below, and it is the largest single piece of work
in this spec.

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
| `POST /api/v1/auth/register` | Weak password or bad email → 400 |
| `POST /api/v1/auth/login` | Missing field → 400 |
| `PATCH /api/v1/me/profile` | Unknown field → 400 (`forbidNonWhitelisted`) |
| `GET /api/v1/products/search` | `page`/`limit` default and coerce → F10 fixed |
| all writes | Unknown properties stripped |

`RegisterDto.role` survives this step — `whitelist` keeps declared fields.
Removing it is D5, in spec-002.

### Verification

- Unit: DTO validation specs for `RegisterDto` and `SearchProductDto`
  (defaults applied, strings coerced to numbers).
- e2e: register with `{"password": "a"}` → 400; `GET …/products` with no query
  → 200 and `page: 1, limit: 20`.

---

## 3. Migrations, one history per context (D3 → F03)

### Changes

1. `backend/src/data-source.ts` — one CLI `DataSource` selected by a
   `DB_CONTEXT` environment variable, reading the same per-context config as
   §4 so the CLI and the application can never disagree:

```ts
const context = process.env.DB_CONTEXT;          // auth | user | catalog | product
export default new DataSource({
  type: 'postgres',
  ...contextDbConfig(context),                    // same helper as app.config.ts
  schema: context,
  entities: [`src/modules/${context}/**/*.entity.ts`],
  migrations: [`src/modules/${context}/**/migrations/*.ts`],
  migrationsTableName: 'migrations',
});
```

2. Per-context migration directories, beside the adapters that own the tables:

| Context | Directory | Tables |
|---|---|---|
| auth | `modules/auth/adapters/outbound/persistence/migrations/` | `users` |
| user | `modules/user/adapters/outbound/persistence/migrations/` | `user_profiles`, `user_sessions` |
| catalog | `modules/catalog/adapters/outbound/persistence/migrations/` | `catalogs` |
| product | `modules/product/adapters/outbound/persistence/migrations/` | `products` |

Each context's first migration begins with
`CREATE SCHEMA IF NOT EXISTS "<context>"`, so a context creates its own schema
and nothing outside it.

3. `backend/scripts/migrate.mjs` — iterates the four contexts and invokes the
   TypeORM CLI once per context, so one command covers the set:

```json
"migration:run":      "node scripts/migrate.mjs run",
"migration:revert":   "node scripts/migrate.mjs revert --context <name>",
"migration:generate": "node scripts/migrate.mjs generate --context <name>"
```

`run` iterates; `generate` and `revert` require an explicit context, because
both are destructive to get wrong.

4. `typeorm.module.ts`: `migrationsRun: false` on every data source — running
   migrations is an explicit step, never a side effect of boot. Drop the
   `entities` glob, which points at `*.entity.ts` paths that do not exist in
   `dist/`; `autoLoadEntities: true` is what actually resolves entities today.

`synchronize` stays false everywhere.

### Verification

- `pnpm migration:run` against a clean database creates four schemas, five
  tables and four independent `migrations` tables.
- `pnpm migration:revert --context catalog` reverts only the catalog schema and
  leaves the other three untouched — this is the check that the histories are
  genuinely independent, and the one that would catch a shared history hiding
  behind four directories.
- CI runs migrations before the e2e suite, so an entity change without a
  migration fails the build rather than the deploy.

---

## 4. One pool per context (D4 → F04)

### 4.1 Config — the fallback chain is the mechanism

`app.config.ts` gains a helper and four blocks. The fallback is what makes a
later split a configuration change:

```ts
const contextDb = (prefix: string, schema: string) => ({
  host:     process.env[`DB_${prefix}_HOST`]     ?? process.env.DB_HOST     ?? 'localhost',
  port:     +(process.env[`DB_${prefix}_PORT`]   ?? process.env.DB_PORT     ?? 5432),
  username: process.env[`DB_${prefix}_USERNAME`] ?? process.env.DB_USERNAME ?? 'postgres',
  password: process.env[`DB_${prefix}_PASSWORD`] ?? process.env.DB_PASSWORD ?? 'postgres',
  database: process.env[`DB_${prefix}_DATABASE`] ?? process.env.DB_DATABASE ?? 'ddd_project',
  schema,
  poolSize: +(process.env[`DB_${prefix}_POOL_SIZE`] ?? 10),
});

database: {
  auth:    contextDb('AUTH',    'auth'),
  user:    contextDb('USER',    'user'),
  catalog: contextDb('CATALOG', 'catalog'),
  product: contextDb('PRODUCT', 'product'),
}
```

With no per-context variables set, all four resolve to the same server and
database, each with its own pool and schema. Setting `DB_CATALOG_HOST` and
`DB_CATALOG_DATABASE` moves Catalog to its own database — no code change.

The existing `database.auth` and `database.user` blocks stop being dead
configuration and become this. `catalog` and `product` are new.

### 4.2 Four named data sources

`shared/adapters/persistence/typeorm/typeorm.module.ts` registers one root per
context instead of one for the application:

```ts
NestTypeOrmModule.forRootAsync({
  name: 'catalog',
  useFactory: (c: ConfigService) => ({
    type: 'postgres',
    ...c.get('app.database.catalog'),
    autoLoadEntities: true,
    synchronize: false,
    migrationsRun: false,
  }),
  inject: [ConfigService],
})
```

### 4.3 Every repository names its connection

There is no default data source after this, so every registration and injection
must name one. Five entities, four repositories, four modules:

```ts
TypeOrmModule.forFeature([TypeOrmCatalog], 'catalog')          // in CatalogModule
@InjectRepository(TypeOrmCatalog, 'catalog')                    // in CatalogRepository
```

| Module | Connection | Entities |
|---|---|---|
| `AuthModule` | `auth` | `TypeOrmUserEntity` |
| `UserModule` | `user` | `TypeOrmUserProfile`, `TypeOrmUserSession` |
| `CatalogModule` | `catalog` | `TypeOrmCatalog` |
| `ProductModule` | `product` | `TypeOrmProduct` |

A missed name fails at container build, which `app.bootstrap.spec.ts` catches —
that spec must be updated to override `getDataSourceToken(name)` and
`getRepositoryToken(entity, name)` for all four connections.

### 4.4 Compose

- `docker-compose.yml` — one `postgres` service on 5432 serving
  `${DB_DATABASE:-ddd_project}`, one volume, the existing healthcheck. This is
  what runs today.
- `docker-compose.multi-db.yml` — the per-context services, carried forward as
  the target topology. Bringing one up and setting that context's `DB_*_*`
  variables is the whole migration path for that context.

### 4.5 What this deliberately makes impossible

No cross-context join and no cross-context transaction. Both are now prevented
by construction rather than by review, which is the point of the seam — and it
is why D10's outbox stops being optional: after this, an outbox is the only
correct way to make two contexts agree on anything.

### 4.6 Move the session store into Auth (D15)

`UserSession`, its TypeORM entity, its repository and `USER_SESSION_REPOSITORY`
move from `modules/user/` to `modules/auth/`, and `user_sessions` becomes a
table in the `auth` schema. The User copies are deleted; nothing has ever read
them.

**This has to happen in this slice, not in spec-002 where refresh tokens are
built.** Under D4 the table is created by whichever context's migration names
it. Put it in `user` now and moving it later is a data migration across two
databases; put it in `auth` now and it costs one `git mv`.

`UserModule` stops binding `USER_SESSION_REPOSITORY` — one dead binding fewer,
and one fewer entity for the `user` connection to load.

### Verification

- `docker compose up -d`, `pnpm migration:run`, `pnpm start:dev` from a clean
  clone, following only `CLAUDE.md`. Currently broken at three separate points;
  acceptance is that it works with no undocumented steps.
- `user_sessions` exists in the `auth` schema and nowhere else.
- Four distinct pools observable in `pg_stat_activity`, grouped by
  `application_name` — set `application_name` per data source so this is
  checkable rather than assumed.
- A smoke check that Catalog can be moved: point `DB_CATALOG_*` at a second
  database, run `pnpm migration:run`, and confirm the catalog endpoints work
  while the others stay on the first. This is the proof that the seam is real,
  and it is the acceptance criterion that matters most in this section.

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
1. POST /api/v1/auth/register  { email, password: "Str0ngPass" }  → 201, tokens
2. the UserCreated handler has created a profile                   → assert row exists
3. POST /api/v1/auth/login                                         → 200, tokens
4. GET  /api/v1/me            with the access token                → 200, profile
5. GET  /api/v1/me            with no token                        → 401
6. POST /api/v1/auth/register { password: "a" }                    → 400
7. GET  /api/v1/products/search                                    → 200, page 1, limit 20
8. GET  /health                                                    → 200, unprefixed
```

Step 2 is the first end-to-end proof of the `UserCreated` flow. PR #3 proved
delivery through the bus with a stubbed repository; this proves it against a
database — and step 2 crosses a context boundary, so under D4 it is also the
first proof that two pools see a consistent picture.

Step 4 is the acceptance for §1: it cannot return 200 unless identity reaches
`RequestContext`.

`backend/test/app.e2e-spec.ts` has already been corrected — it asserted
`GET /` returning `Hello World!`, a route that has not existed since the
scaffold. It still cannot run until §3 and §4 land.

---

## 7. Task order

Each task ends green — build, tests, and the checks named.

| # | Task | Verified by |
|---|------|-------------|
| 1 | Delete `package-lock.json`; `lint` stops fixing; add `lint:fix` | `pnpm lint` reports without writing |
| 2 | Formatting commit, alone | `pnpm lint` → 0 errors |
| 3 | Compose: one `postgres`, plus the multi-db file (§4.4) | `docker compose up -d` healthy |
| 4 | Per-context config with the fallback chain (§4.1) | Unit test: unset vars → shared database, distinct schemas |
| 4b | Move the session store into Auth (§4.6) | `USER_SESSION_REPOSITORY` gone from `UserModule`; suite still green |
| 5 | Four named data sources; every repository names its connection (§4.2, §4.3) | `app.bootstrap.spec.ts` resolves with four connections overridden |
| 6 | Per-context migrations and `scripts/migrate.mjs` (§3) | `migration:run`, then `revert --context catalog` touches only catalog |
| 7 | Identity in `JwtAuthGuard` (§1) | Guard unit test |
| 8 | Global `ValidationPipe`; delete the custom pipe (§2) | DTO unit tests; container still resolves |
| 9 | e2e suite (§6) | The seven assertions |
| 10 | CI workflow (§5) | The workflow passes on its own pull request |
| 11 | Move-a-context smoke check (§4.5) | Catalog on a second database, others unmoved |

Order matters in three places: 2 before everything else so no later diff
carries formatting noise; 5 before 6, because migrations need the data sources
they run against; 6 before 9, because the e2e suite needs a schema.

Tasks 4–6 are the bulk of this slice. They are also the only tasks that are
cheaper now than after another context is added.

## Risks

| Risk | Likelihood | Handling |
|---|---|---|
| Global validation rejects a request that works today | **high — by design** | Task 7's e2e lands with task 6, not after |
| `forbidNonWhitelisted` is stricter than a client expects | medium | Named in D2; drop to `whitelist` alone if it bites |
| Generated migration does not match hand-written entity intent | medium | Read the generated SQL before committing; never commit a generated migration unread |
| Compose change wipes local data | low | Volumes are renamed, not reused; `docker compose down -v` first |
| Identity mapping wrong for a future API-key path | low | `authMethod` is explicit; D12 removes the unbuilt API-key port |
| A repository misses its connection name and silently uses the wrong pool | **medium** | There is no default connection, so a missed name cannot resolve — it fails at container build, caught by `app.bootstrap.spec.ts` |
| Connection exhaustion: 4 pools × 10 against PostgreSQL's default 100 | low | Sized in config, not left to the driver; CI runs a smaller pool |
| Migration histories drift into a shared one behind four directories | medium | Task 6's acceptance is a per-context revert, which fails if the histories are not independent |

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
