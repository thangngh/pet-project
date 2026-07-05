# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Monolithic NestJS 10 API with Domain-Driven Design + Hexagonal Architecture (Ports & Adapters). Stack: TypeORM 0.3, PostgreSQL, Passport JWT, Winston, Throttler rate-limit, Axios HTTP, CQRS event bus.

**Source in `backend/`** — all commands run from `backend/` directory. See [LICENSE](./LICENSE) for license terms.

## Commands

Source is in `backend/` — prefix all commands with `cd backend &&` or set working directory to `backend/`.

```bash
# Dev
cd backend && pnpm start:dev          # Watch mode on :3001
cd backend && pnpm start:debug        # Debug + watch

# Build
cd backend && pnpm build

# All tests
cd backend && pnpm test               # Jest (src/**/*.spec.ts)
cd backend && pnpm test:cov           # Coverage
cd backend && pnpm test:e2e           # E2E (test/**/*.e2e-spec.ts)

# Single test
cd backend && pnpm jest -- src/app.controller.spec.ts

# Lint
cd backend && pnpm lint
```

## Architecture — Hexagonal (Ports & Adapters) = 4 DDD Layers

Each layer maps a DDD architectural layer to a Hexagonal role:

| DDD Layer | Hexagonal Role | Directory | Description | NestJS Deps |
|-----------|---------------|-----------|-------------|-------------|
| **Domain** | Core (pure language) | `domain/` | Entities, VOs, domain events, outbound port interfaces | Pure TS — no imports from any package |
| **Application** | Use cases | `application/` | One use case per feature, Command/Query handling center, DTOs | ✅ Injectable decorator only |
| **Presentation** | Inbound adapters | `adapters/inbound/` | Controllers, guards, decorators — driving side | Full |
| **Infrastructure** | Outbound adapters | `adapters/outbound/` | Persistence (TypeORM), external APIs, auth guards/strategies — driven side | Full |

### Shared Kernel — 4 Layers

```
backend/src/shared/
  domain/                       # DDD: DOMAIN
    value-objects/              # Base ValueObject<T> — frozen props, equals()
    errors/                     # DomainError -> NotFoundError, ValidationError, UnauthorizedError
  application/                  # DDD: APPLICATION
    pipes/                      # Global ValidationPipe (class-validator + class-transformer)
    filters/                    # GlobalExceptionFilter (DomainError -> HTTP mapping)
  adapters/                     # DDD: INFRASTRUCTURE + PRESENTATION
    config/                     # NestJS ConfigModule + Joi env validation (infrastructure)
    logger/                     # Winston module + LoggingInterceptor (infrastructure)
    rate-limit/                 # ThrottlerModule + global ThrottlerGuard (infrastructure)
    http/                       # Axios HttpModule wrapper (infrastructure)
    event-bus/                  # CQRS EventBus + DomainEvent base (infrastructure)
    persistence/typeorm/        # TypeORM root, autoLoadEntities, async config (infrastructure)
    feature-gate/               # @Gate decorator + GateGuard (presentation)
    tenant/                     # TenantContext resolver (presentation)
    request-context/            # RequestContext middleware + RequestIdentity type (presentation)
```

### Per-Bounded-Context Structure

```
backend/modules/<context>/
  <context>.module.ts           # Composition root — wires ports -> adapters via useClass

  domain/                       # DDD: DOMAIN LAYER — pure TypeScript, zero package imports
    entities/                   # Aggregate roots (e.g. User, Product)
    value-objects/              # Value objects (UserId, Email, Password)
    ports/                      # OUTBOUND port interfaces (e.g. IUserRepository)

  application/                  # DDD: APPLICATION LAYER — depends on domain ports only
    ports/                      # INBOUND port interfaces (e.g. IAuthService)
    use-cases/                  # ONE FILE per feature (RegisterUserUseCase, GetProfileUseCase)
    handlers/                   # Command/Query handling center — dispatches to correct use case
    services/                   # Orchestrators (EventBusService, shared UC logic)
    dto/                        # Request/response DTOs

  adapters/
    inbound/                    # DDD: PRESENTATION LAYER — controllers, guards
      controllers/              # Inject @Inject(AUTH_SERVICE) IAuthService, never concrete
    outbound/                   # DDD: INFRASTRUCTURE LAYER — persistence, external
      persistence/              # TypeORM entities + repository implementations
      <integration>/            # External adapters (JWT strategy, API clients)
```

### Dependency Rule

Dependencies point **inward** toward Domain:

```
Domain (pure TS — zero package imports)
  <- Application (depends on domain ports only)
    <- Adapters: inbound (controllers)/outbound (repositories) — never import concrete services
      <- Composition root (module file wires tokens via useClass)
```

**Golden rule:** Domain layer is **pure language** (TypeScript). Zero imports from any package — not `@nestjs/*`, not `uuid`, not `bcrypt`. Only language-level types (`string`, `Date`, `Record<>`, etc.). Domain entities, value objects, and port interfaces must compile with zero dependencies on any runtime package.

A controller may never import a concrete service class — only its port interface.

## Authentication — Auth BC: Token Issuer + Middleware Port

Auth is a **bounded context** (`backend/modules/auth/`). Two roles:

1. **Token issuer** — Login → returns JWT or API Key
2. **Middleware port provider** — exports `IAuthMiddlewarePort` for per-request validation

### Complete Flow

```
USER LOGIN → POST /auth/login → Auth BC → returns { accessToken, refreshToken }

EVERY REQUEST:
Client sends: Authorization: Bearer <jwt> or X-API-Key: <key>

AuthGuard calls IAuthMiddlewarePort.validateToken(token)
  → identity { userId, tenantId, roles } written to RequestContext

AFTER AUTH SUCCESS → deeper layers:

┌─ PRESENTATION ──── Controller reads identity from RequestContext
│                   @Gate('feature') check → calls use case
├─ APPLICATION ───── Reads userId from RequestContext for ownership
│                   Option A: calls IAuthMiddlewarePort.validateApiKey() again
│                   Option B: implements own security (HMAC, mTLS, signed payload)
├─ DOMAIN ────────── Pure TS. Never sees auth types.
```

### Auth Port Interface

```ts
// backend/modules/auth/application/ports/auth-middleware.port.ts
export const AUTH_MIDDLEWARE_PORT = 'AUTH_MIDDLEWARE_PORT';

export interface IAuthMiddlewarePort {
  validateToken(token: string): Promise<RequestIdentity>;
  validateApiKey(apiKey: string): Promise<RequestIdentity>;
}
```

Other BCs depend on this port interface, never on auth domain types.

### Where Auth Lives

| Component | Location |
|-----------|----------|
| Domain (User, credentials, tokens) | `backend/modules/auth/domain/` |
| Use cases (register, login, refresh) | `backend/modules/auth/application/` |
| Auth middleware port interface | `backend/modules/auth/application/ports/` |
| Controllers | `backend/modules/auth/adapters/inbound/` |
| AuthGuard, strategies, decorators | `backend/modules/auth/adapters/outbound/auth/` |

### Layer-by-Layer Auth

| Layer | Mechanism |
|-------|-----------|
| Entry | AuthGuard via `IAuthMiddlewarePort` |
| Presentation | Reads identity from RequestContext |
| Application | Option A: Re-validate via `IAuthMiddlewarePort`. Option B: Own security contract |
| Domain | Never — pure business logic |

### Per-Layer Auth Awareness

| Layer | Sees Auth? | Mechanism |
|-------|-----------|-----------|
| **Domain** | Never | Pure business logic. No auth types, no identity awareness. |
| **Application** | Via RequestContext | Reads userId/tenantId/roles from context for ownership checks. Never imports auth package. |
| **Presentation** | Guards | `@UseGuards(AuthGuard)`, `@Public()`, `@Roles('admin')` |
| **Infrastructure** | Full | Token parsing, key validation, identity resolution |

### Per-Context Auth Strategy

| Context | Recommended Credential |
|---------|----------------------|
| Auth (login/register) | `@Public()` — unauthenticated |
| User | JWT |
| Product Catalog | JWT (admin writes), API Key (public reads) |
| Shipping | JWT |
| Order / Payment | JWT |
| Worker / Scheduler | API Key |
| CI/CD | API Key |

## Use Case Pattern — One per Feature

Each discrete feature gets one self-contained use case file:

```
application/use-cases/
  register-user.use-case.ts     # RegisterUserUseCase
  login.use-case.ts             # LoginUseCase
  get-profile.use-case.ts       # GetProfileUseCase
```

Each use case: **validate input → construct VOs → call domain → persist → publish events → return**

```ts
// use-cases/register-user.use-case.ts
export class RegisterUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    /* ... */
  ) {}

  async execute(dto: RegisterDto): Promise<AuthTokens> {
    const email = new Email(dto.email);                // 1. VO validation
    const existing = await this.userRepo.findByEmail(email);
    if (existing) throw new DomainError('...');        // 2. Domain rule
    const user = User.create(email, password);          // 3. Aggregate
    await this.userRepo.save(user);                     // 4. Persist (via port)
    await this.eventBus.publishEvents(user.events);     // 5. Events
    return tokens;                                      // 6. Return
  }
}
```

## CQRS Decision — Adopt After Gate Create for High Write/Read Features

CQRS is not default. Decision rule after gate enables a feature:

```
Feature enabled via @Gate() gate rerun
  → Monitor: does it have high write AND high read volume?
    → Yes: adopt CQRS — split Command (write) and Query (read) use cases
             with separate models/ports/optimized repositories
    → No:  keep simple — single use case handles both write and read
```

**When to adopt CQRS in a context:**
- Write path and read path have different shapes (e.g. Order writes complex aggregates, reads flat projections)
- Read queries need performance optimization (denormalized views, caching, separate indexes) that would complicate writes
- Write operations trigger domain events / outbox that reads should not wait for

**How to structure CQRS (only when decision is YES):**

```
application/
  commands/                     # Write side
    place-order.command.ts
    cancel-order.command.ts
  queries/                      # Read side
    get-order.query.ts
    list-user-orders.query.ts
  handlers/                     # Separate dispatchers
    command-handler.ts
    query-handler.ts
```

Both commands and queries still go through `@Gate()` — gating is orthogonal to CQRS.

## Handling Center (Command/Query Dispatcher)

Central entry for all application operations. Decouples controller from use case directly:

```
application/handlers/
  command-handler.ts              # dispatch({ type, payload }) → routes to use case
  query-handler.ts                # dispatch({ type, params }) → routes to query
  index.ts                        # Single exported dispatch()
```

## Layer Mappings — Cross-Layer Communication

### Application → Presentation (output)

```
Use Case returns domain object → Handler/Controller maps to DTO → JSON response
```

Use case never returns a DTO. Returns domain/application objects. Controller maps to DTO.

### Application → Domain (input)

```
Controller receives DTO → Use Case maps DTO → VO (constructs Email, Password, etc.) → Domain aggregate
```

Presentation never constructs domain VOs. Use case handles DTO → VO mapping.

### Domain → Infrastructure (repository boundary)

```
Application depends on IUserRepository (domain port) ← implements → UserRepository (TypeORM)
```

Application never imports infrastructure. Module wires port → adapter via `useClass`.

## Key Patterns

### Port Injection
- String tokens: `USER_REPOSITORY`, `AUTH_SERVICE`
- Controllers: `@Inject(AUTH_SERVICE) private readonly authService: IAuthService`
- Services: `@Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository`

### Config Namespace
Config is registered under the `app` namespace via `registerAs('app', ...)`. Access values as:
```ts
configService.get<string>('app.jwt.secret')
configService.get<number>('app.database.port')
```
See `backend/src/shared/adapters/config/app.config.ts` for all keys.

### Domain Errors
```ts
DomainError (pure TS)         // base — extends Error, sets name from constructor
  NotFoundError               // -> HTTP 404 — entity not found
  ValidationError             // -> HTTP 400 — VO construction failed
  UnauthorizedError           // -> HTTP 401 — not allowed
  ConflictError               // -> HTTP 409 — duplicate/conflict
```
Thrown by entities/VOs/domain services. Mapped by GlobalExceptionFilter via name.

### Application Errors
```ts
ApplicationError (pure TS)    // base — orchestration failures
  ResourceNotFoundError       // -> HTTP 404
  OperationForbiddenError     // -> HTTP 403
  InvalidInputError           // -> HTTP 400
```
Thrown by use cases for application-level failures not covered by domain rules.

### Infrastructure Errors
```ts
InfrastructureError           // base — technical failures
  DatabaseError               // -> HTTP 500
  ExternalServiceError        // -> HTTP 500
  ConfigurationError          // -> HTTP 500
```
Thrown by adapters. Never caught in application/domain — let bubble to filter.

### Exception Layer Boundary
Each layer throws its own exception types. GlobalExceptionFilter maps all to HTTP:
- DomainError -> map by name (400/401/404/409/500)
- ApplicationError -> map by name (400/403/404/500)
- InfrastructureError -> 500
- HttpException -> pass through
- GateException -> 503

### Domain Events
- Extend `DomainEvent` (sets `occurredOn` + `eventName` in constructor)
- Collected on aggregate, published via `EventBusService.publishEvents()`, cleared after `save()`

### Feature Gates
- `@Gate('feature-name')` decorator on controller methods
- Global `GateGuard` checks maintenance mode (`API_LOCKED=true`)
- `FeatureGateService` reads from env config: `FEATURE_X=true/false`
- Disabled features return 503 with `code: "FEATURE_DISABLED"`

### Auth (Bounded Context + Middleware Provider)
- Auth is a BC (`backend/modules/auth/`) with User domain, register/login use cases, JWT/API Key adapters
- **All requests pass through AuthGuard first** — validates JWT Bearer or X-API-Key
- Identity extracted to `RequestContext` — other BCs never import auth domain types
- `@Public()` skips auth, `@Roles('admin')` gates by role

## Environment

```bash
cp .env.example .env
```
See `.env.example` for all variables. No `.env` is committed — each dev creates their own.

## Session Pipeline — Memory → Audit → Checkpoint

After user begins, each session runs this pipeline at session start, per request, and on explicit user request.

```
User begins
  │
  ▼
┌─────────────┐
│  MEMORY     │  ◄─ Load MEMORY.md index → recall relevant memories
│  old / new  │  ◄─ Write new memories, update changed ones
│  / update   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  AUDIT      │  ◄─ Full feature audit: scan src/ vs CLAUDE.md vs memory
│  full /     │  ◄─ Update audit after code changes
│  update /   │  ◄─ Request audit on user command
│  request    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  CHECKPOINT │  ◄─ Per session: full snapshot at start
│  session /  │  ◄─ Per request: change log after each tool turn
│  request /  │  ◄─ On user /checkpoint: deep diff vs session snapshot
│  per-req    │
└─────────────┘
       │
       ▼
    Proceed to feature work
```

### 1. Memory

Persistent file-based memory at `.claude/memory/` (project-local, not global user profile). Each memory = one file with frontmatter:

```markdown
---
name: <kebab-slug>
description: <one-line summary>
metadata:
  type: user | feedback | project | reference
---

<the fact>
```

| Operation | When | What |
|-----------|------|------|
| **Old memory** | Session start | Load MEMORY.md index, recall relevant memories via description |
| **New memory** | New fact discovered | Write to memory/ as .md file |
| **Update memory** | Fact changed | Re-read existing file, update content, preserve name |

Source of truth index: `.claude/memory/MEMORY.md` — one link per memory file.

### 2. Audit

Run after memory is loaded. Evaluates current project state against stored memory.

| Operation | When | What |
|-----------|------|------|
| **Full feature audit** | Session start | Scan src/ structure, compare against CLAUDE.md and memory. Detect drift, missing files, stale paths |
| **Update feature audit** | After code change | Re-scan changed directories, verify new code matches architecture pattern |
| **Request feature audit** | On user request | Targeted audit of specific context/feature the user names |

Each audit outputs: what matches, what drifts, action needed (create/update/delete).

### 3. Checkpoint

Three checkpoints exist. A checkpoint records current state: file tree, key file hashes, architecture conformance.

| Checkpoint | Trigger | Records |
|------------|---------|---------|
| **Per session** | Session start | Full project snapshot — file tree, CLAUDE.md hash, memory index hash |
| **Per request** | After each tool-use turn | Change log: files read/written/edited, decisions made, gates created/passed |
| **If user requests** | On `/checkpoint` or explicit ask | Deep snapshot + diff against per-session checkpoint |

Checkpoints stored in `.claude/memory/checkpoints/` — auto-clean after 30 days.

## Gate Artifact — Save per Gate Run

Each gate run produces an artifact saved in markdown format. Artifacts support decision-making and evaluate results.

### Artifact Location

```
docs/gates/
  <context>/
    <feature-name>/
      gate-001--<name>.md      # First gate run
      gate-002--<name>.md      # Second gate run (rerun after test)
      gate-003--<name>.md      # Final gate (enable)
```

### Artifact Template (saved as .md)

Every markdown artifact is split into two sections.

**Section 1 — Decision (written BEFORE gate run):**

```markdown
# Gate: user-profile

## Gate Run: 001
**Date:** 2026-07-05
**Feature:** user-profile
**Gate Type:** [create | rerun | final-enable]

## Decision Context
- **Feature:** User profile management (GET /me, PATCH /me)
- **Status:** Implementation complete, tests needed
- **Dependencies:** Auth context, RequestContext, TenantContext

## Criteria
- [x] Use case implemented
- [x] Tests pass (pipeline/unit)
- [ ] Integration test passes
- [x] Review passed

## Decision
[PASS | FAIL | RERUN]
**Reason:** <why pass/fail/rerun>
```

**Section 2 — Evaluation (written AFTER gate result):**

```markdown
## Evaluation Result

### Outcome
**Gate decision:** PASS
**Action:** Rerun with integration tests

### Evidence
- Unit tests: 4/4 passed
- Integration tests: skipped (no DB)
- Lint: clean

### Issues Found
- Integration test missing for UserRepository.findById

### Next Step
Enable integration test, then gate rerun (gate-002)
```

### Complete Example

```markdown
# Gate: user-profile

## Gate Run: 001
**Date:** 2026-07-05
**Feature:** user-profile
**Gate Type:** create

## Decision Context
- **Feature:** User profile management (GET /me, PATCH /me)
- **Status:** Implemented + unit tests
- **Dependencies:** Auth context, RequestContext

## Criteria
- [x] Use case implemented
- [x] Unit tests pass
- [ ] Integration tests pass
- [x] No lint errors

## Decision
RERUN
**Reason:** Integration tests need DB connection

## Evaluation Result

### Outcome
**Gate decision:** RERUN
**Action:** Add docker-compose up before integration tests

### Evidence
- Unit tests: 4/4 passed
- Lint: clean

### Issues Found
- Docker not running → integration tests skipped
- Missing test DB config in CI

### Next Step
Set up test DB, then gate-002 rerun
```

## Workflow Pipeline — Automated Execution

Harness-driven pipeline for feature implementation. Uses multi-agent orchestration (Workflow tool) with defined cost budget + expected result.

### Pipeline Lifecycle

```
User requests feature
  │
  ▼
┌────────────────────────────────────────────┐
│ 1. PROPOSE                                 │
│    - Define pipeline phases                │
│    - Set cost budget (token target)        │
│    - Declare expected result               │
│    - Present to user                       │
└──────────┬─────────────────────────────────┘
           │ user confirms
           ▼
┌────────────────────────────────────────────┐
│ 2. EXECUTE                                 │
│    - Run Workflow script                   │
│    - budget.total enforces cap             │
│    - Each agent() call consumes budget     │
│    - Phase results stream in real-time     │
└──────────┬─────────────────────────────────┘
           │
           ▼
  ┌────────────────┐     NO (over + incomplete)
  │ Budget OK?     │─────────────────────────────┐
  │ Result met?    │                             │
  └────────┬───────┘                             │
           │ YES                                 │
           ▼                                     ▼
  ┌──────────────────┐               ┌─────────────────────────┐
  │ 3. REPORT        │               │ 4. OVERSIGHT PAUSE      │
  │    - Summary     │               │    - Report spent/cost   │
  │    - Evidence    │               │    - Show partial result │
  │    - Next step   │               │    - Ask user:           │
  └──────────────────┘               │      Continue? +top-up   │
                                     │      Abort?              │
                                     └─────────────────────────┘
                                              │ user decision
                                              │
                                    ┌─────────┴─────────┐
                                    │ continue (+budget) │
                                    │ abort (rollback)   │
                                    └───────────────────┘
```

### 1. Proposal Phase

Before any execution, present to user:

```yaml
pipeline:
  feature: <feature-name>
  phases:
    - review      # Review spec + existing code
    - plan        # Create implementation plan, gate-001 artifact
    - implement   # Write code (use cases, adapters, tests)
    - test        # Run build + tests
    - gate        # Gate rerun or final-enable, gate-002/003 artifact
  cost_budget:
    tokens: <N>k     # Token target for entire pipeline
    hard_cap: true    # Enforced — cannot exceed without user approval
  expected_result:
    - Build passes
    - All tests pass
    - Gate artifact saved at docs/gates/<context>/<feature>/
    - <specific success criteria>
```

User confirms → execute. User rejects → revise or abort.

### 2. Execution Phase — Workflow Script

Pipeline runs as a Workflow script. Each phase is a `phase()` call, agents implement the work.

```javascript
export const meta = {
  name: 'implement-feature',
  description: 'Implement a feature through spec→plan→code→test→gate',
  phases: [
    { title: 'Review' },
    { title: 'Plan' },
    { title: 'Implement' },
    { title: 'Test' },
    { title: 'Gate' },
  ],
}

phase('Review')
const codebase = await agent('Scan codebase: existing patterns, related files, spec doc', {...})

phase('Plan')
const plan = await agent('Create implementation plan + gate-001 artifact', {...})

phase('Implement')
const code = await agent('Implement code: use cases, adapters, tests, DTOs', {...})

phase('Test')
const results = await agent('Run build + tests, fix failures', {...})

phase('Gate')
const gate = await agent('Evaluate results, write gate-002/003 artifact', {...})
```

### 3. Cost Budget & Overspend Protocol

| Concept | Rule |
|---------|------|
| **budget.total** | Set in proposal — token target for the pipeline |
| **budget.spent()** | Accumulates across all agents in the workflow |
| **budget.remaining()** | `max(0, total - spent())` — `Infinity` if no target |
| **Hard cap** | Once `spent()` reaches `total`, `agent()` calls throw |

When budget exceeded AND expected result not met:

1. Pipeline pauses automatically
2. Report to user: `spent / total tokens, result: <partial>, missing: <gaps>`
3. Ask: continue with top-up budget? abort?
4. User decision:
   - **Continue**: define additional budget, resume pipeline
   - **Abort**: rollback partial work, save checkpoint for later

### 4. Pipeline Templates

#### Feature Implementation (standard)

```
phases: review → plan → implement → test → gate
budget: 150k-300k tokens
```

#### Bug Fix (lightweight)

```
phases: diagnose → fix → verify
budget: 50k-100k tokens
```

#### Refactor / Architecture Change

```
phases: audit → design → migrate → verify → gate
budget: 200k-500k tokens
```

### 5. Error Handling

- **Agent failure**: agent() returns `null` (user skipped or API error) — filter with `.filter(Boolean)`
- **Phase failure**: pipeline stage throws → item drops to `null`, remaining stages for that item skipped
- **Budget exceeded**: `agent()` throws → Workflow catches, pauses, reports to user
- **Recovery**: resume from failed phase using stored gate artifact + checkpoint
