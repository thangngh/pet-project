# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

## How to read this file

Every statement here is marked, because this file was once a plan that got read
as a description — three gate artifacts recorded "Issues Found: None" for
features that had never run, and the auth section described a port nothing
implemented (see `docs/audit/audit-2026-08-17.md`).

| Marker | Meaning |
|---|---|
| **[built]** | Exists in `backend/src` today and is exercised by a test |
| **[plan]** | Intended design. **Not built.** Do not describe it as existing |
| *(unmarked)* | A rule for how to write new code, not a claim about current code |

If you change code so a **[plan]** becomes real, move the marker in the same
commit. If you find a **[built]** claim that is false, that is a defect in this
file — fix it here first, then decide about the code.

## Project overview

Monolithic NestJS 10 API, Domain-Driven Design + Hexagonal Architecture
(Ports & Adapters). **[built]** Stack: TypeORM 0.3 on PostgreSQL 16, Passport
JWT, Winston, Throttler, Axios, `@nestjs/cqrs` (used for its `EventBus` inside
a context — *not* for cross-context delivery, see Outbox).

**All source is under `backend/src/`.** Run every command from `backend/`.
See [LICENSE](./LICENSE) for license terms.

## Getting a clean clone running

This is the whole sequence. It was verified from an empty database.

```bash
cd backend
cp .env.example .env          # the file lives in backend/, not the repo root
pnpm install                  # pnpm only — pnpm-lock.yaml is the one lockfile

# A PostgreSQL 16 server on localhost:5432 with database `ddd_project`.
docker compose up -d          # from the repo root — one postgres container

pnpm migration:run            # REQUIRED. Nothing creates tables at boot:
                              # synchronize is off everywhere, deliberately.
pnpm seed:admin               # the only way to make the first admin
pnpm start:dev                # :3001
```

Skipping `migration:run` gives a process that starts and then fails every
request with `relation does not exist`. There is no auto-sync fallback and
there should not be one.

**[plan]** `docker compose up -d` has not been run in this repository's CI or
in any session that produced these notes — the verification above used a local
PostgreSQL 16 cluster. The compose file is believed correct and is unproven.

## Commands

```bash
# Dev
cd backend && pnpm start:dev          # watch mode on :3001
cd backend && pnpm start:debug

# Build / lint
cd backend && pnpm build
cd backend && pnpm lint               # reports only; `lint:fix` writes

# Tests
cd backend && pnpm test               # jest, src/**/*.spec.ts
cd backend && pnpm test:cov
cd backend && pnpm test:e2e           # test/**/*.e2e-spec.ts — needs a live DB
cd backend && pnpm jest -- src/app.controller.spec.ts   # single file

# Migrations — per context, see "Persistence"
cd backend && pnpm migration:run                     # every context
cd backend && pnpm migration:show                    # every context
cd backend && pnpm migration:revert   --context=catalog
cd backend && pnpm migration:generate --context=catalog --name=AddThing

# Admin
cd backend && pnpm seed:admin

# Docker (from the repo root)
docker compose up -d                  # one postgres, all contexts share it
docker compose -f docker-compose.multi-db.yml up -d   # one postgres per context
docker compose down -v                # reset data
```

When reading `pnpm test` output, check the **`Suites:`** line as well as
`Tests:`. A suite that fails to compile contributes zero tests, so a broken
suite can hide behind a rising pass count.

## Architecture — Hexagonal (Ports & Adapters) = 4 DDD layers

| DDD layer | Hexagonal role | Directory | NestJS deps |
|---|---|---|---|
| **Domain** | Core | `domain/` | Pure TS — no package imports |
| **Application** | Use cases | `application/` | `@Injectable` / `@Inject` only |
| **Presentation** | Inbound adapters | `adapters/inbound/` | Full |
| **Infrastructure** | Outbound adapters | `adapters/outbound/` | Full |

### Dependency rule

Dependencies point **inward**:

```
Domain (pure TS — zero package imports)
  <- Application (domain ports only)
    <- Adapters: inbound (controllers) / outbound (repositories)
      <- Composition root (the module file wires tokens via useClass)
```

**Golden rule:** the domain layer is pure language. No `@nestjs/*`, no `uuid`,
no `bcrypt` — only `string`, `Date`, `Record<>` and friends. A controller may
never import a concrete service class, only its port interface.

### Shared kernel — what is actually there

**[built]**, verified file by file:

```
backend/src/shared/
  domain/
    value-objects/value-object.ts      # base ValueObject<T> — frozen props, equals()
    errors/domain-error.ts             # DomainError + 3 subclasses (see Errors)
  application/
    filters/global-exception.filter.ts # DomainError/HttpException -> HTTP
  adapters/
    config/                            # ConfigModule + Joi validation + context-db.config.ts
    logger/                            # Winston module + LoggingInterceptor
    rate-limit/                        # ThrottlerModule + global ThrottlerGuard
    http/                              # Axios HttpModule wrapper
    event-bus/                         # CQRS EventBus + DomainEvent base
    event-bus/integration-events/      # cross-context event contracts + registry
    outbox/                            # transactional outbox, poller, dispatcher, health
    persistence/typeorm/               # four named data sources, one per context
    feature-gate/                      # @Gate, @SkipGate, global GateGuard
    request-context/                   # middleware, AsyncLocalStorage service, RequestIdentity
```

**[plan]** `shared/adapters/tenant/` — a `TenantContext` resolver. **Not
built.** Multi-tenancy left scope; `RequestIdentity.attributes` is where a
`tenantId` would go if it returns.

**[plan]** `shared/application/pipes/` — the global `ValidationPipe` is
configured inline in `app.module.ts` as an `APP_PIPE` provider, not in a
directory of its own. There is nothing to put there yet.

### Per-bounded-context structure

Contexts live in **`backend/src/modules/<context>/`** — `auth`, `user`,
`catalog`, `product`. **[built]**

```
backend/src/modules/<context>/
  <context>.module.ts           # composition root — wires ports -> adapters

  domain/                       # pure TypeScript, zero package imports
    entities/                   # aggregate roots
    value-objects/              # Email, Password, UserId
    ports/                      # OUTBOUND port interfaces (IUserRepository)

  application/
    ports/                      # INBOUND port interfaces (IAuthService)
    use-cases/                  # one file per feature
    handlers/                   # integration-event consumers
    dto/                        # request/response DTOs

  adapters/
    inbound/controllers/        # inject port tokens, never concrete classes
    outbound/persistence/       # TypeORM entities, repositories, migrations
    outbound/<integration>/     # JWT strategy, guards, API clients
```

Not every context has every directory, and that is fine — an empty directory is
worse than an absent one. What each has today:

| Context | `use-cases/` | `handlers/` | `value-objects/` | Outbox |
|---|---|---|---|---|
| `auth` | **no** — see below | no | yes | yes |
| `user` | yes (2) | yes (1) | yes | no |
| `catalog` | yes (5) | no | no | yes |
| `product` | yes (10) | yes (1) | no | no |

**Auth is the exception to one-use-case-per-feature.** Its features live as
methods on a single `AuthService` behind `IAuthService`. This is drift from the
rule below, documented rather than fixed: the methods share session handling,
token signing and hashing, and splitting them would mean either duplicating
that or inventing a shared service the rule does not describe either. Write
*new* contexts with `use-cases/`.

## Use case pattern — one per feature

Each discrete feature gets one self-contained file:

```
application/use-cases/
  create-catalog.use-case.ts
  archive-catalog.use-case.ts
  get-profile.use-case.ts
```

Each one: **validate input → construct VOs → call domain → persist → enqueue
events → return.**

```ts
export class RegisterUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
  ) {}

  async execute(dto: RegisterDto): Promise<AuthTokens> {
    const email = new Email(dto.email);                 // 1. VO validation
    if (await this.userRepo.findByEmail(email))
      throw new ValidationError('...');                 // 2. domain rule
    const user = User.create(email, password);          // 3. aggregate
    await this.outbox.transaction(async (tx) => {       // 4. persist + enqueue
      await this.userRepo.save(user, tx);               //    in ONE transaction
      await this.outbox.write(user.events, tx);
      user.clearEvents();
    });
    return tokens;                                      // 5. return
  }
}
```

A repository must **not** clear an aggregate's events. It did once, and every
`UserCreated` was dropped before anything could publish it: registration
returned 201 and no profile was ever created. Only a real database exposed it —
the test that should have caught it stubbed the repository at fault.

## Cross-layer mapping

**Application → Presentation.** A use case returns a domain or application
object, never a DTO. The controller maps to the DTO.

**Presentation → Application.** The controller passes the DTO through. It never
constructs domain value objects; the use case maps DTO → VO.

**Application → Infrastructure.** The application depends on the domain port
(`IUserRepository`); the module wires the TypeORM implementation via
`useClass`. The application never imports infrastructure.

## Persistence — per-context pools and schemas

**[built]** Four named TypeORM data sources, one per context, each with its own
connection pool and its own PostgreSQL schema (`auth`, `user`, `catalog`,
`product`). `synchronize` and `migrationsRun` are off on all four.

Connection settings resolve in two steps, in
`shared/adapters/config/context-db.config.ts`:

```
DB_<CONTEXT>_<SETTING>   ->   DB_<SETTING>   ->   built-in default
```

Unset, every context lands on the same server and database in its own schema.
Setting `DB_CATALOG_HOST` and `DB_CATALOG_DATABASE` moves catalog to a database
of its own with **no code change** — that is the entire database-per-context
migration path, and it has been exercised end to end.

**Migration histories are per context.** Each context owns a `migrations` table
inside its own schema, so `revert` on catalog cannot touch auth. Migrations
live in `modules/<context>/adapters/outbound/persistence/migrations/`.

Two traps, both hit for real:

- **Declare indexes on the entity.** A hand-written `CREATE INDEX` in a
  migration that the entity does not declare shows up as drift, and the next
  generated migration drops it.
- **The schema must exist before the CLI runs.** TypeORM writes its
  `migrations` table into the context schema *before* running the migration
  that creates that schema. `scripts/migrate.mjs` runs `src/ensure-schema.ts`
  first for this reason.

## Authentication — how it actually works

**[built]** Passport JWT. There is no global auth guard.

```
POST /api/v1/auth/login  ->  { accessToken, refreshToken }

Protected routes carry @UseGuards(JwtAuthGuard) — per controller or per method.
  JwtAuthGuard extends AuthGuard('jwt')
    -> JwtStrategy validates the bearer token
    -> handleRequest writes { userId, roles, authMethod: 'jwt' }
       into RequestContext (AsyncLocalStorage)

Everything past that point reads identity from RequestContext.
```

Identity is written in the **guard**, not the middleware: the middleware runs
before guards and cannot tell an authenticated route from a public one, and
parsing tokens there would mean two components verify JWTs.

Refresh tokens are **rotated and hashed**. A `user_sessions` row stores the
SHA-256 of the token, never the token. Presenting a revoked refresh token
revokes every session for that user — reuse is treated as compromise. Each
token carries a `sid`, without which two refreshes in the same second produce
byte-identical tokens (JWT `iat` has one-second granularity).

| Layer | Sees auth? | Mechanism |
|---|---|---|
| **Domain** | Never | Pure business logic. No auth types. |
| **Application** | Via `RequestContext` | Reads `userId`/`roles` for ownership. Never imports auth. |
| **Presentation** | Guards | `@UseGuards(JwtAuthGuard)`, `@Roles(ROLE_ADMIN)` |
| **Infrastructure** | Full | Token parsing, session hashing, identity resolution |

Other contexts **never** import auth domain types. They read `RequestIdentity`
from `shared/adapters/request-context/request-context.types.ts`, which is the
single definition of that shape.

### Guards, and where they are registered

| Guard | Scope | Notes |
|---|---|---|
| `ThrottlerGuard` | global (`APP_GUARD`) | rate limiting |
| `GateGuard` | global (`APP_GUARD`) | `@Gate()` + `API_LOCKED`; `@SkipGate()` opts out |
| `AttributesGuard` | global (`APP_GUARD`) | ABAC; inert unless `FEATURE_ABAC=true` |
| `JwtAuthGuard` | **per controller/method** | not global |
| `RolesGuard` | **per method** | inert unless `FEATURE_RBAC=true` |

**`@Public()` currently enforces nothing.** `JwtAuthGuard` honours it, but
because that guard is applied per controller rather than globally, the routes
marked `@Public()` have no guard on them in the first place. The decorator
records intent and would start mattering the moment `JwtAuthGuard` becomes an
`APP_GUARD`. Do not read it as a security control today.

**`FEATURE_RBAC` is not optional.** With it off, all eleven `@Roles(ROLE_ADMIN)`
endpoints accept any authenticated caller. Turn it on — and create an admin
with `pnpm seed:admin` first, or it locks those endpoints against everyone.

**[plan]** API keys. `RequestIdentity.authMethod` reserves `'api_key'` and
nothing issues or validates one. The per-context credential table below is a
plan for when workers and schedulers exist; today every context is JWT.

| Context | Credential | Status |
|---|---|---|
| Auth (login/register) | none | **[built]** |
| User, Catalog, Product | JWT | **[built]** |
| Worker / Scheduler / CI | API key | **[plan]** — no such component exists |

A dead `AUTH_MIDDLEWARE_PORT` with `validateToken`/`validateApiKey` was
described here for months and implemented by nothing. It was deleted in
spec-004 rather than built, because building it would have designed an API-key
mechanism with no caller to shape it — which is how it came to be dead.

## Domain events and the outbox

**[built]** Two delivery paths, and the difference matters.

**Within a context**, `@nestjs/cqrs`'s `EventBus` is available. It is
fire-and-forget: `publish` returns `void`, handlers run detached, and their
errors vanish into an `UnhandledExceptionBus` nothing subscribes to.

**Between contexts**, use the **transactional outbox**. Under per-context pools
there is no cross-context transaction, so this is not an upgrade over a better
option — it is the only way two contexts can agree on anything.

```
use case
  └─ outbox.transaction(tx):
       repo.save(aggregate, tx)        ─┐ one transaction:
       outbox.write(events, tx)        ─┘ both or neither

OutboxPoller (every context that publishes)
  └─ SELECT ... FOR UPDATE SKIP LOCKED, exponential backoff on attempts
       └─ IntegrationEventDispatcher.dispatch(event)   ← awaited, and it throws
            └─ handler in the consuming context (idempotent — at-least-once)
```

`outbox.write` **requires** the transaction manager rather than accepting an
optional one: an enqueue outside the aggregate's transaction is the exact bug
the outbox exists to prevent, so it is not expressible.

The dispatcher is not the `EventBus`, for the reason above — through the bus,
every message would be marked delivered whether or not its handler succeeded,
and `attempts`, the backoff and the give-up threshold would never fire once.

Consequences to keep in mind:

- **Consumers must be idempotent.** Delivery is at-least-once. Check-then-write.
- **Cross-context reads are eventually consistent.** `GET /me` immediately
  after registering can 404 until the poller runs.
- **Only `auth` and `catalog` have an outbox table.** `user` and `product`
  publish nothing. A context that starts publishing without one fails loudly
  (`relation does not exist`), which is the intent — add the migration then.
- Event names come from `constructor.name` and are keys into
  `event-bus/integration-events/registry.ts`. **Renaming an event class
  orphans every message already in the outbox**, undispatched forever, while
  writes keep succeeding.

`GET /health` reports outbox depth and answers `status: "degraded"` with HTTP
**200** when messages are stuck. That is deliberate: `/health` is the liveness
probe, and a restart cannot unstick an outbox — the messages are in the
database, not in memory. Failing liveness would only flap.

## Feature gates

**[built]** `@Gate('featureName')` on a controller method; the global
`GateGuard` checks `FeatureGateService`, which reads `app.features.*` from env
(`FEATURE_USER_PROFILE`, `FEATURE_PRODUCT_CATALOG`, `FEATURE_RBAC`,
`FEATURE_ABAC`). A disabled feature returns **503** with
`{ code: "FEATURE_DISABLED", feature }`.

`API_LOCKED=true` locks the whole API with **503** and
`{ code: "API_LOCKED" }` — a distinct code, because an orchestrator seeing
`FEATURE_DISABLED` during a deliberate maintenance window learns the wrong
thing. `@SkipGate()` exempts a route; `/health` carries it, so maintenance mode
does not get the process restarted.

**[plan]** `FEATURE_SHIPPING` is reserved. There is no shipping code.

## Errors

**[built]** — this is the complete list:

```
DomainError (pure TS, extends Error, sets name from the constructor)
  NotFoundError        -> 404
  ValidationError      -> 400
  UnauthorizedError    -> 401
```

`GlobalExceptionFilter` maps by `name`, passes `HttpException` through
(preserving extra body fields such as `code`), and turns anything else into
500.

**[plan]** — described here for years, **none of it exists**. Do not import
these; do not assume a caller can catch them:

- `ConflictError` (409)
- `ApplicationError` → `ResourceNotFoundError`, `OperationForbiddenError`,
  `InvalidInputError`
- `InfrastructureError` → `DatabaseError`, `ExternalServiceError`,
  `ConfigurationError`

Today a use case throws a `DomainError` subclass or a Nest `HttpException`, and
adapter failures bubble to the filter as 500. If you need one of the above,
build it and move the marker.

## Config

Registered under the `app` namespace via `registerAs('app', ...)`:

```ts
configService.get<string>('app.jwt.secret')
configService.get<boolean>('app.features.rbac')
```

All keys are in `backend/src/shared/adapters/config/app.config.ts`; env
variables are validated with Joi at boot. Per-context database settings come
from `context-db.config.ts` (see Persistence).

## Routing

**[built]** Global prefix `api/v1` from `API_PREFIX`, with `health` excluded so
probes survive a version bump.

| Route | Auth | Gate |
|---|---|---|
| `GET /health` | none | `@SkipGate()` |
| `POST /api/v1/auth/{register,login,refresh,logout}` | none | — |
| `POST /api/v1/auth/change-password`, `GET /api/v1/auth/profile` | JWT | — |
| `POST /api/v1/auth/users/:id/role` | JWT + admin | — |
| `GET /api/v1/me`, `PATCH /api/v1/me/profile` | JWT | `userProfile` |
| `/api/v1/catalogs/*` | JWT (writes admin) | `productCatalog` |
| `/api/v1/products/*` | JWT (writes admin) | `productCatalog` |

## Port injection

String tokens, injected by interface:

```ts
@Inject(AUTH_SERVICE)   private readonly authService: IAuthService
@Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository
```

## Structure that is documented, not built

Named here so nobody implements from a description and finds it missing.

**[plan] Handling centre.** A `application/handlers/command-handler.ts` +
`query-handler.ts` dispatcher decoupling controllers from use cases. **No
context has one.** Controllers call use cases directly. `handlers/` in `user`
and `product` holds integration-event consumers, which is a different thing.

**[plan] CQRS command/query split.** No context separates `commands/` from
`queries/`. CQRS is not a default and is not adopted anywhere. The rule for
when it would be worth adopting:

- the write and read paths have genuinely different shapes; **and**
- reads need optimisation (projections, caching, separate indexes) that would
  complicate writes; **and**
- writes trigger events that reads must not wait on.

Gating is orthogonal to this — commands and queries both go through `@Gate()`.

## Environment

```bash
cd backend && cp .env.example .env
```

`backend/.env.example` lists every variable with notes. No `.env` is committed.

## Where the records live

| What | Where |
|---|---|
| Findings from the 2026-08-17 audit, with status | `docs/audit/audit-2026-08-17.md` |
| Decisions taken on those findings | `docs/decision.md` |
| Remediation specs (001–004) | `docs/specs/` |
| Gate artifacts, per context | `docs/gates/<context>/` |
| Session memory index | `.claude/memory/MEMORY.md` |
| Checkpoints | `.claude/memory/checkpoints/` |

### Gate artifacts

A gate run is recorded at `docs/gates/<context>/gate-NNN--<name>.md`, in two
parts: **Decision**, written before the run (context, criteria, PASS/FAIL/
RERUN), and **Evaluation Result**, written after (outcome, evidence, issues
found, next step).

The evidence section is the point of the artifact, and it has one rule:

> **Do not write "Issues Found: None" for something that has not been run.**

Three gates recorded exactly that for features with no test and no live
database behind them. If a criterion was not verified, say which one and why
— an unverified criterion recorded honestly costs nothing; recorded as a pass
it removes the reason to ever check.
