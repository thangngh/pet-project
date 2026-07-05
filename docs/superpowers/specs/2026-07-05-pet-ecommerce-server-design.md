# Pet E-commerce Server — Architecture & Delivery Spec

**Date:** 2026-07-05
**Status:** Draft
**Architecture:** Hexagonal (Ports & Adapters) + DDD — Modular Monolith

---

## 1. Purpose

Build a monolithic NestJS API server for a Pet E-commerce platform using Domain-Driven Design with Hexagonal Architecture. Server-first development with feature gating. Development workflow: `spec → plan → gate → test → gate rerun → make feature`.

---

## 2. Architecture Principles

### 2.1 Hexagonal Architecture (Ports & Adapters) = 4 Architectural Layers of DDD

Every bounded context maps the 4 DDD layers to Hexagonal roles:

| DDD Layer | Hexagonal Role | Directory | Responsibility | NestJS Deps |
|-----------|---------------|-----------|---------------|-------------|
| **Domain** | Core (pure language) | `domain/` | Entities, VOs, domain events, outbound port interfaces | ❌ Pure TS — no imports from any package including NestJS. Only language-level types. |
| **Application** | Use cases | `application/` | One use case per feature, Command/Query pattern, handling center dispatcher, DTOs | ✅ Injectable decorator only |
| **Presentation** | Inbound adapters (driving) | `adapters/inbound/` | Controllers, request/response mapping | ✅ Full NestJS |
| **Infrastructure** | Outbound adapters (driven) | `adapters/outbound/` | Persistence (TypeORM), external API clients | ✅ Full NestJS |

#### Layer Structure per Bounded Context

```
module/
├── <context>.module.ts          # Composition root — wires ports → adapters via useClass
│
├── domain/                       # DDD: DOMAIN LAYER — pure TypeScript, zero imports from any package
│   ├── entities/                 # Aggregate roots
│   ├── value-objects/            # Value objects with inline validation
│   └── ports/                    # Outbound port interfaces (repository contracts)
│
├── application/                  # DDD: APPLICATION LAYER — depends on domain ports only
│   ├── ports/                    # Inbound port interfaces (IAuthService, IUserService)
│   ├── use-cases/                # ONE FILE per feature (RegisterUserUseCase, GetProfileUseCase)
│   │                             # Each: validate → call domain → publish event → return result
│   ├── services/                 # Orchestrators, domain service facades (optional, for shared UC logic)
│   ├── dto/                      # Request/response DTOs (RegisterDto, LoginDto, etc.)
│   └── handlers/                 # Command / Query handling center — dispatches to correct use case
│
└── adapters/
    ├── inbound/                  # DDD: PRESENTATION LAYER — controllers, guards
    │   └── controllers/          # Inject port interfaces via @Inject(TOKEN)
    │
    └── outbound/                 # DDD: INFRASTRUCTURE LAYER — persistence, external
        ├── persistence/          # TypeORM entities + repository implementations
        └── <integration>/        # External service adapters
```

#### Shared Kernel — 4 Layers

```
src/shared/
├── domain/                       # DDD: DOMAIN
│   ├── value-objects/            # Base ValueObject<T>, ID types
│   └── errors/                   # DomainError hierarchy (NotFound, Validation, Unauthorized)
│
├── application/                  # DDD: APPLICATION
│   ├── pipes/                    # Global ValidationPipe
│   └── filters/                  # GlobalExceptionFilter (DomainError → HTTP)
│
└── adapters/                     # DDD: INFRASTRUCTURE + PRESENTATION
    ├── config/                   # ConfigModule (Joi) — infra
    ├── logger/                   # Winston module + LoggingInterceptor — infra
    ├── rate-limit/               # ThrottlerModule — infra
    ├── http/                     # Axios HttpModule — infra
    ├── event-bus/                # CQRS + DomainEvent — infra
    ├── persistence/typeorm/      # TypeORM root config — infra
    ├── feature-gate/             # @Gate decorator + GateGuard — presentation/infra
    ├── tenant/                   # TenantContext — presentation
    └── request-context/          # RequestContext middleware + RequestIdentity — presentation
```

### 2.2 Use Case Pattern — One File per Feature, Handling Center

Each discrete feature gets its own use case file. The handling center dispatches commands/queries to the correct use case.

```
application/
  ports/              # Inbound port interfaces
    auth-service.port.ts
    user-service.port.ts

  use-cases/          # ONE FILE per feature — self-contained, testable
    register-user.use-case.ts       # RegisterUserUseCase
    login.use-case.ts               # LoginUseCase
    get-profile.use-case.ts         # GetProfileUseCase
    update-profile.use-case.ts      # UpdateProfileUseCase
    change-password.use-case.ts     # ChangePasswordUseCase
    refresh-token.use-case.ts       # RefreshTokenUseCase

  handlers/           # Handling center — entry point for all operations
    command-handler.ts              # dispatch(command) → routes to use case
    query-handler.ts                # dispatch(query) → routes to use case
    index.ts                        # Single exported dispatch()

  dto/                # Request/response DTOs
    register.dto.ts
    login.dto.ts
    user-profile.dto.ts

  services/           # Orchestrators (optional, shared UC logic)
    event-bus.service.ts
```

**Use case structure (each file):**

```ts
// use-cases/register-user.use-case.ts
export class RegisterUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    private readonly jwtService: JwtService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(dto: RegisterDto): Promise<AuthTokens> {
    // 1. Validate (domain VOs)
    const email = new Email(dto.email);
    // 2. Check domain rules
    const existing = await this.userRepo.findByEmail(email);
    if (existing) throw new DomainError('Email already registered');
    // 3. Execute (aggregate creation)
    const user = User.create(email, password, dto.role);
    // 4. Persist
    await this.userRepo.save(user);
    // 5. Publish events
    await this.eventBus.publishEvents(user.events);
    // 6. Return result
    return tokens;
  }
}
```

**Handling center (dispatcher):**

```ts
// handlers/command-handler.ts
@Injectable()
export class CommandHandler {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly login: LoginUseCase,
    // ...
  ) {}

  async dispatch(command: { type: string; payload: unknown }) {
    switch (command.type) {
      case 'REGISTER_USER':
        return this.registerUser.execute(command.payload as RegisterDto);
      case 'LOGIN':
        return this.login.execute(command.payload as LoginDto);
      // ...
    }
  }
}
```

### 2.3 Layer Mappings — Cross-Layer Communication

Each boundary crossing follows a strict mapping pattern:

#### Application → Presentation (driven side — output)

```
Use Case returns:      AuthTokens (domain/application object)
       ↓
Handler formats:       Maps AuthTokens → AuthResponseDto
       ↓
Controller returns:    AuthResponseDto (serialized as JSON response)
```

```
┌──────────────────┐     ┌────────────────────┐     ┌──────────────────┐
│  Use Case        │ →   │  Handler (optional) │ →   │  Controller      │
│  returns result  │     │  domain → DTO map   │     │  returns DTO     │
└──────────────────┘     └────────────────────┘     └──────────────────┘
```

**Rule:** Use case never returns a DTO. It returns domain/application objects. Handler or controller maps to DTO.

#### Application → Domain (driving side — input)

```
Controller receives:  RegisterDto (Presentation DTO)
       ↓
Use case validates:   new Email(dto.email), new Password(dto.password) — VOs guard invariants
       ↓
Domain executes:      User.create(email, password) — aggregate root
```

```
┌──────────────────┐     ┌────────────────────┐     ┌──────────────────┐
│  Controller      │ →   │  Use Case          │ →   │  Domain Entity   │
│  receives DTO    │     │  dto → VO mapping  │     │  aggregate method│
└──────────────────┘     └────────────────────┘     └──────────────────┘
```

**Rule:** Presentation layer never constructs domain VOs directly. Use case handles DTO → VO mapping as its first responsibility.

#### Domain → Infrastructure (repository boundary)

```
Use Case calls:      this.userRepo.save(user) — depends on IUserRepository port
       ↓
Port (domain):       interface IUserRepository { save(user: User): Promise<void> }
       ↓
Adapter (infra):     UserRepository implements IUserRepository — TypeORM logic
```

```
┌──────────────────┐     ┌─────────────────────────┐     ┌──────────────────────┐
│  Domain Port     │ ←   │  Application (use case)  │ →   │  Infra Adapter       │
│  IUserRepository │     │  depends on port only    │     │  UserRepository      │
└──────────────────┘     └─────────────────────────┘     └──────────────────────┘
```

**Rule:** Application layer depends on **domain port interfaces**, never on infrastructure implementations. Module (composition root) wires the concrete adapter to the port token.

### 2.4 CQRS Decision — Adopt After Gate Create for High Write/Read Features

CQRS is not default applied. Decision rule invoked after `@Gate()` gate rerun enables a feature:

```
Feature enabled via @Gate() gate rerun
  → Evaluate: does it have high write AND high read volume?
    → YES: adopt CQRS — split Command (write) and Query (read) use cases
            with separate models/ports/optimized repositories
    → NO:  keep simple — single use case handles both write and read
```

**When to adopt CQRS in a context:**
- Write path and read path have fundamentally different shapes (e.g. Order writes complex aggregate, reads flat projections)
- Read queries need distinct performance optimization (denormalized view, dedicated cache, separate index) that would add complexity to writes
- Write operations fire domain events / outbox that reads must not wait for

**CQRS structure (only when decision = YES):**

```
application/
  commands/                     # Write side — one file per command
    place-order.command.ts
    cancel-order.command.ts
  queries/                      # Read side — one file per query
    get-order.query.ts
    list-user-orders.query.ts
  handlers/                     # Separate dispatchers
    command-handler.ts          # dispatch(command) → routes to Command
    query-handler.ts            # dispatch(query) → routes to Query
```

Both commands and queries remain behind `@Gate()` — gating is orthogonal to CQRS.

#### Complete Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│  API GATEWAY                                                 │
│  All requests enter here                                     │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌─ AUTH BC (modules/auth/) ───────────────────────────────────┐
│  AuthGuard validates: JWT (Bearer) or API Key (X-API-Key)    │
│  → extracts identity { userId, tenantId, roles }             │
│  → writes to RequestContext                                  │
│  → passes through if valid, rejects if invalid               │
├──────────────────────────────────────────────────────────────┤
│  Auth domain: User aggregate, credentials, session, tokens   │
│  Auth controllers: /auth/register, /auth/login               │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌─ PRESENTATION ──────────────────────────────────────────────┐
│  @Gate('feature') → Controller                              │
│  (gate check → route handler)                               │
└────────────────────────┬────────────────────────────────────┘
                         │ reads identity from RequestContext
                         ▼
┌─ APPLICATION ───────────────────────────────────────────────┐
│  Handling Center                                            │
│  ├── CommandHandler.dispatch({ type, payload })              │
│  └── QueryHandler.dispatch({ type, params })                 │
│       │                                                      │
│       ▼                                                      │
│  Use Case (one per feature)                                  │
│  ├── 1. Read userId from RequestContext (never auth types)   │
│  ├── 2. Validate input (construct VOs)                       │
│  ├── 3. Call domain aggregate/entity                         │
│  ├── 4. Persist via domain port                              │
│  └── 5. Publish events → return result                       │
└────────────────────────┬─────────────────────────────────────┘
                         │ depends on domain ports only
                         ▼
┌─ DOMAIN (other BCs) ────────────────────────────────────────┐
│  Pure TypeScript — zero imports. NOT aware of auth.         │
│  Identity: never imported, never referenced.                │
└──────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────┐
│  Auth Bounded Context               │
│  (modules/auth/)                    │
│  ├── Domain: User, credentials      │
│  ├── Application: login, register   │
│  └── Adapters: controllers +         │
│      EXPORTS: AuthGuard, strategies, │
│      identity resolver              │
└──────────┬──────────────────────────┘
           │ all requests pass through
           ▼
┌─────────────────────────────────────┐
│  Domain (other BCs)                 │
│  Pure TS. Never imports auth.       │
└──────────┬──────────────────────────┘
           │
┌──────────▼──────────────────────────┐
│  Application (other BCs)            │
│  Reads identity from RequestContext │
│  Never imports auth domain types    │
└──────────┬──────────────────────────┘
           │
┌──────────▼──────────────────────────┐
│  Adapters (other BCs)               │
│  Controllers, persistence,          │
│  external adapters                  │
└──────────┬──────────────────────────┘
           │
┌──────────▼──────────────────────────┐
│  Composition root                   │
│  Wires tokens → useClass            │
└─────────────────────────────────────┘
```

**Golden rule:** Domain layer is **pure language** (TypeScript). Zero imports from any package — not `@nestjs/*`, not `uuid`, not `bcrypt`. Only language-level types (`string`, `Date`, `Record<>`, etc.). Domain entities, value objects, and port interfaces must compile with zero dependencies on any runtime package.

A controller may never import a concrete service class — only its port interface.

### 2.5 Auth Bounded Context — Token Issuer + Middleware Port Provider

Auth is a **bounded context** (`modules/auth/`). Two responsibilities:

1. **Token issuer** — User login → returns JWT or API Key
2. **Middleware port provider** — Exports a port interface (`IAuthMiddlewarePort`) that all incoming requests use for per-request validation

#### Complete Flow

```
┌──────────────────────────────────────────────────────────────────┐
│  USER LOGIN                                                      │
│  POST /auth/login → Auth BC validates credentials                │
│  → returns { accessToken: "jwt...", refreshToken: "..." }        │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  EVERY REQUEST (per-request auth)                                │
│                                                                  │
│  Client sends: Authorization: Bearer <jwt>                       │
│            or: X-API-Key: <api_key>                              │
│                                                                  │
│  Authentication Middleware (uses AUTH_MIDDLEWARE_PORT)            │
│  ├── calls auth port: validateToken(token) → identity            │
│  └── success → writes identity to RequestContext                 │
│                                                                  │
│  AUTH_MIDDLEWARE_PORT = interface exported by Auth BC:            │
│    interface IAuthMiddlewarePort {                               │
│      validateToken(token: string): Promise<RequestIdentity>;     │
│      validateApiKey(apiKey: string): Promise<RequestIdentity>;   │
│    }                                                             │
│    Token: AUTH_MIDDLEWARE_PORT                                    │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  AFTER AUTH SUCCESS → Enter deeper layers                        │
│                                                                  │
│  ┌─ PRESENTATION ──────────────────────────────────────────────┐│
│  │  Controller reads identity from RequestContext               ││
│  │  @Gate('feature') check                                      ││
│  │  Calls use case                                              ││
│  └──────────────────────────┬──────────────────────────────────┘│
│                             │                                   │
│  ┌─ APPLICATION ───────────▼──────────────────────────────────┐│
│  │  Use case: validates API Key via auth port again OR uses   ││
│  │  its own security (each layer authenticates independently) ││
│  │                                                             ││
│  │  Option A: Call auth port again for API Key check           ││
│  │    this.authMiddleware.validateApiKey(layerApiKey)          ││
│  │                                                             ││
│  │  Option B: Implement layer-specific security contract       ││
│  │    (e.g., signed payload, HMAC, mutual TLS cert)            ││
│  │                                                             ││
│  │  Reads identity/userId from RequestContext for ownership    ││
│  └──────────────────────────┬──────────────────────────────────┘│
│                             │                                   │
│  ┌─ DOMAIN ─────────────────▼──────────────────────────────────┐│
│  │  Pure TS — NEVER sees auth types. Never imports auth.       ││
│  │  Operates on business data only.                            ││
│  └─────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

#### Auth Port Interface (exported for other layers)

```ts
// modules/auth/application/ports/auth-middleware.port.ts
export const AUTH_MIDDLEWARE_PORT = 'AUTH_MIDDLEWARE_PORT';

export interface RequestIdentity {
  userId: string;
  tenantId: string;
  roles: string[];
  authMethod: 'jwt' | 'api_key';
}

export interface IAuthMiddlewarePort {
  validateToken(token: string): Promise<RequestIdentity>;
  validateApiKey(apiKey: string): Promise<RequestIdentity>;
}
```

This port is implemented by Auth BC adapters and injected wherever middleware is needed.

#### Layer-by-Layer Authentication

| Layer | Auth Mechanism | How |
|-------|---------------|-----|
| **API Gateway / Entry** | AuthGuard uses `IAuthMiddlewarePort` | Validates JWT or API Key per request |
| **Presentation** | Reads identity from RequestContext | Controller knows who called |
| **Application** | Option A: Calls `IAuthMiddlewarePort.validateApiKey()` again | Re-validates for sensitive operations |
| **Application** | Option B: Implements own security contract | HMAC, signed payload, mTLS — independent of auth BC |
| **Domain** | Never | Pure business logic. Zero auth awareness. |

#### Where Auth Components Live

| Component | Location | Purpose |
|-----------|----------|---------|
| Domain (User, credentials, tokens) | `modules/auth/domain/` | Core auth business logic |
| Use cases (register, login, refresh) | `modules/auth/application/` | Auth operations |
| Auth middleware port interface | `modules/auth/application/ports/` | `IAuthMiddlewarePort` exported for other layers |
| Controllers | `modules/auth/adapters/inbound/` | /auth/register, /auth/login |
| JWT/API Key strategies | `modules/auth/adapters/outbound/auth/` | Token validation |
| AuthGuard (uses port) | `modules/auth/adapters/outbound/auth/` | Per-request guard, calls `IAuthMiddlewarePort` |
| Identity resolver | `modules/auth/adapters/outbound/auth/` | Writes identity → RequestContext |

#### Supported Credentials

| Credential | Transport | When |
|------------|-----------|------|
| **JWT Token** | `Authorization: Bearer <token>` | User sessions (login/register flow) |
| **API Key** | `X-API-Key: <key>` | Per-layer auth, machine-to-machine, CI/CD |

#### Per-Context Auth Configuration

```ts
// Auth context — login/register is public (no token needed)
@Public()
@Post('login')
async login() { ... }

// Other contexts — auth required via middleware port
@UseGuards(AuthGuard)  // uses IAuthMiddlewarePort internally
@Controller('products')
export class ProductController { ... }

// Role-gated — auth + specific role
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
@Post('catalog')
async createCatalog() { ... }
```

**Other bounded contexts NEVER import from `modules/auth/domain/`.** They depend on `IAuthMiddlewarePort` (application layer port interface) if they need re-validation. Identity flows through `RequestContext`, not through domain imports.

#### Dual Role

```
┌──────────────────────────────────────────────────────────────┐
│  AUTH BOUNDED CONTEXT (modules/auth/)                        │
│                                                              │
│  Domain: User aggregate, credentials, sessions, tokens       │
│  Application: RegisterUser, Login, RefreshToken, etc.        │
│  Adapters: controllers (register/login), repository, JWT     │
│                                                              │
│  + EXPORTS middleware/guards for all other contexts:         │
│    AuthGuard, JwtStrategy, ApiKeyStrategy, RolesGuard,       │
│    Public decorator, identity resolver                       │
└──────────────────────┬───────────────────────────────────────┘
                       │ ALL requests pass through auth first
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  API GATEWAY → AuthGuard (validate JWT or API Key)           │
│    → identity { userId, tenantId, roles }                    │
│      → written to RequestContext                             │
│        → route handler reads identity from context           │
│          → domain NEVER touches auth types                   │
└──────────────────────────────────────────────────────────────┘
```

#### Architectural Rule

```
API Gateway → AuthGuard (validate token/api_key)
  → extracts identity { userId, tenantId, roles }
    → attaches to RequestContext
      → controller calls use case
        → use case reads identity from context
          → domain operates on business data only
```

**Other bounded contexts NEVER import from `modules/auth/domain/`.** Identity flows through `RequestContext`, not through domain imports. Auth domain types (User, UserId, etc.) are internal to the auth context — other contexts reference users by `userId: string` only.

#### Where Auth Components Live

| Component | Location | Purpose |
|-----------|----------|---------|
| Domain (User, credentials, tokens) | `modules/auth/domain/` | Core auth business logic |
| Use cases (register, login, refresh) | `modules/auth/application/` | Auth operations |
| Controllers | `modules/auth/adapters/inbound/` | /auth/register, /auth/login |
| JWT/API Key strategies | `modules/auth/adapters/outbound/auth/` | Token validation |
| AuthGuard, RolesGuard, decorators | `modules/auth/adapters/outbound/auth/` | Express middleware for all routes |
| Identity resolver | `modules/auth/adapters/outbound/auth/` | Writes identity → RequestContext |

The guards/strategies/decorators live in `modules/auth/adapters/outbound/auth/` but are **registered globally** in `app.module.ts` so every request passes through auth first.

#### Supported Credentials

| Credential | Transport | When |
|------------|-----------|------|
| **JWT Token** | `Authorization: Bearer <token>` | User sessions (login/register flow) |
| **API Key** | `X-API-Key: <key>` | Machine-to-machine, CI/CD, internal services |

Both hit the same `AuthGuard` — it tries JWT first, falls back to API Key, rejects if neither is valid.

#### How Each Layer Sees Auth

| Layer | Sees Auth? | How |
|-------|-----------|-----|
| **Domain** (other BCs) | ❌ Never | Pure business logic. No auth types, no identity awareness |
| **Application** (other BCs) | ✅ Via RequestContext | Reads `identity.userId` for ownership checks, never imports auth domain |
| **Presentation** (other BCs) | ✅ Via guards | `@UseGuards(AuthGuard)` on controllers, `@Public()` to skip |
| **Auth BC itself** | ✅ Full | Owns User aggregate, credentials, tokens, strategies |

#### Per-Context Auth Configuration

```ts
// Auth context — login/register is public
@Public()
@Post('login')
async login() { ... }

// Other contexts — auth required (JWT or API Key)
@UseGuards(AuthGuard)
@Controller('products')
export class ProductController { ... }

// Role-gated — auth + specific role
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
@Post('catalog')
async createCatalog() { ... }
```

No other bounded context's domain/application code changes when auth strategy changes (JWT → OAuth, API Key rotation). It's purely an auth-context concern.

---

## 3. Bounded Context Inventory

| Phase | Context | Status | Description |
|-------|---------|--------|-------------|
| 0 | **Auth** | ✅ DONE | Bounded context + middleware for all requests. User aggregate, JWT + API Key, guards |
| 1 | **User** | **⬅ NEXT** | Profile, identity, session management |
| 2 | Product Catalog | 📋 Planned | Catalogs, products, attributes, media |
| 3 | Shipping | 📋 Planned | Addresses, shipments, COD |
| 4+ | Order | 📋 Planned | Cart, order lifecycle |
| 4+ | Inventory | 📋 Planned | Stock, reservation |
| 4+ | Payment | 📋 Planned | Invoice, payment gateway integration |

### 3.1 Auth Bounded Context (Current — Complete)

Auth is both:
1. **A bounded context** (`modules/auth/`) — manages User aggregate, credentials, sessions, tokens
2. **Middleware provider** — exports AuthGuard, JWT/API Key strategies, identity resolver that all requests pass through

**Internal structure:**
- Domain: User aggregate, UserId/Email/Password VOs, IUserRepository port
- Application: RegisterUser, Login, RefreshToken, GetProfile use cases
- Adapters (inbound): /auth/register, /auth/login controllers
- Adapters (outbound): UserRepository (TypeORM), JwtStrategy, ApiKeyStrategy, AuthGuard, RolesGuard, Public decorator

**Other BCs never import auth domain types.** Identity flows via RequestContext.

### 3.2 User Context (Phase 1 — Next)

Per the spec in `docs/User Context — Backend Specification.md`:

- **UserProfile aggregate:** firstName, lastName, phone, avatar
- **UserIdentity entity:** password hash, provider support (email, OAuth)
- **UserSession entity:** refresh token lifecycle, expiry
- **Use cases:** GetProfile, UpdateProfile, ChangePassword, RefreshToken
- **Multi-tenant:** tenantId on all entities, TenantContext filter at repository level

### 3.3 Product Catalog Context (Phase 2)

Per the spec in `docs/Product Catalog Context — Backend Specification.md`:

- **Catalog aggregate:** tree structure with parent/child
- **Product aggregate:** base info, status (draft/published/archived)
- **ProductAttribute entity:** key-value attributes per product
- **ProductMedia entity:** images, ordering
- **Cross-context:** ProductId as business reference only — no FK to other contexts

### 3.4 Shipping Context (Phase 3)

Per the spec in `docs/Shipping Context — Backend Specification.md`:

- **CustomerAddress entity:** CRUD, default address
- **Shipment aggregate:** lifecycle (created → picked → delivered/failed)
- **COD management:** separate from payment lifecycle
- **Tracking events:** immutable event log per shipment

---

## 4. Shared Kernel Extensions

### 4.1 Existing (from scaffold)

| Module | Layer | Purpose |
|--------|-------|---------|
| Config (Joi) | Infrastructure | Env validation, `app.*` config namespace |
| Logger (Winston) | Infrastructure | Console transport, structured format |
| Rate-limit | Infrastructure | ThrottlerModule + global ThrottlerGuard |
| HTTP (Axios) | Infrastructure | 10s timeout, 3 redirects |
| Event-bus (CQRS) | Infrastructure | DomainEvent base class, EventBusService |
| TypeORM | Infrastructure | autoLoadEntities, async config |
| Auth guards/strategies | Infrastructure | JWT + API Key auth, identity resolver, role guard |
| Domain errors | Domain | DomainError, NotFound, Validation, Unauthorized, Conflict |
| Global exception filter | Application | Maps layer exceptions → HTTP responses |
| Validation pipe | Application | class-validator + class-transformer |

### 4.2 To Add

#### Feature Gate System

```
src/shared/adapters/feature-gate/
├── feature-gate.module.ts
├── feature-gate.service.ts        # Reads gate config from ConfigService
├── feature-gate.guard.ts          # Global GateGuard
├── gate.decorator.ts              # @Gate('feature-name')
└── feature-gate.types.ts          # FeatureFlag type, GateConfig
```

- **@Gate('feature-name')** — per-endpoint decorator. Returns 503 with `{ code: "FEATURE_DISABLED", feature: "..." }` when disabled.
- **GateGuard (global)** — checks maintenance mode (`API_LOCKED=true`). Blocks all routes when set.
- **FeatureGateService** — reads from `app.features.*` config path. Hybrid: env-driven now, supports DB override later via merge mechanism.
- **Config entries:** `FEATURE_USER_PROFILE=true/false`, `FEATURE_PRODUCT_CATALOG=true/false`, etc. Default to `false` until explicitly enabled.

#### TenantContext

```
src/shared/adapters/tenant/
├── tenant.module.ts
├── tenant.service.ts              # Resolves current tenant from request/JWT
├── tenant.decorator.ts            # @Tenant() param decorator
└── tenant.interceptor.ts          # Extracts tenant from JWT claim
```

- Reads tenantId from JWT payload or header
- Provides `TenantContext` to application layer
- Repository-level filter via TenantService

#### RequestContext

```
src/shared/adapters/request-context/
├── request-context.module.ts
├── request-context.service.ts     # Stores requestId, correlationId, operation timestamp
├── request-context.middleware.ts  # Generates/reads X-Request-Id, X-Correlation-Id
```

- Every request gets requestId + correlationId
- Accessible via `RequestContextService.get()`
- Logged by LoggingInterceptor

---

## 5. Feature Gate Architecture

### 5.1 Components

```
┌────────────────────────────────────────────────────────────┐
│                     GateGuard (global)                      │
│  Registered as APP_GUARD                                    │
│  ┌────────────────────────────────────┐                     │
│  │ 1. Check API_LOCKED env var        │                     │
│  │    → true: return 503 LOCKED       │                     │
│  │ 2. Allow Public() routes through   │                     │
│  │ 3. Let @Gate decorator handle      │                     │
│  └────────────────────────────────────┘                     │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│                  @Gate('feature-name')                       │
│  Applied per controller method                              │
│  ┌────────────────────────────────────┐                     │
│  │ 1. Read app.features[featureName]  │                     │
│  │    from ConfigService              │                     │
│  │ 2. If disabled → throw             │                     │
│  │    GateException (503)             │                     │
│  │ 3. If enabled → pass through       │                     │
│  └────────────────────────────────────┘                     │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│                  FeatureGateService                          │
│  Injectable — shared across guards/services                 │
│  ┌────────────────────────────────────┐                     │
│  │ isEnabled(feature: string): bool   │                     │
│  │ getFeatureFlags(): Record<string,bool>                   │
│  │ // Future: mergeEnvWithDb()        │                     │
│  └────────────────────────────────────┘                     │
└────────────────────────────────────────────────────────────┘
```

### 5.2 Gating Strategy

| Level | Mechanism | Effect |
|-------|-----------|--------|
| Global | `GateGuard` + `API_LOCKED` | Blocks ALL routes, maintenance mode |
| Per-feature | `@Gate('user-profile')` | Blocks specific endpoint group |
| Per-role | `@Roles('admin')` (existing) | Blocks by user role |
| Auth | `@Public()` / `JwtAuthGuard` (existing) | Blocks unauthenticated |

### 5.3 Dev Workflow with Gates

```
1. SPEC     — Write spec doc for feature
2. PLAN     — Create implementation plan
3. GATE     — Create @Gate('feature-name'), disabled by default
4. IMPLEMENT — Build domain → application → adapters
5. TEST     — Write tests against gated endpoint (tests set flag via config override)
6. GATE RERUN — Set FEATURE_X=true in .env, endpoint goes live
7. VERIFY   — End-to-end working
```

---

## 6. Docker Setup

### docker-compose.yml

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    container_name: pet-postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: ${DB_USERNAME:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
      POSTGRES_DB: ${DB_DATABASE:-ddd_project}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USERNAME:-postgres}"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
```

### .env additions for features

```env
# Feature Gates (default: disabled)
FEATURE_USER_PROFILE=false
FEATURE_PRODUCT_CATALOG=false
FEATURE_SHIPPING=false

# Maintenance
API_LOCKED=false
```

### docker-compose.dev.yml (optional, for worker mode)

```yaml
services:
  postgres:
    # same as above, ports optional if only used internally
    ports: ["5432:5432"]
```

---

## 7. Development Workflow

### 7.1 Gate Workflow Loop

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌──────────┐
│  SPEC   │ →  │  PLAN   │ →  │  GATE   │ →  │  TEST   │ →  │GATE RERUN│
│  Design │    │ writing │    │ @Gate() │    │ flag on │    │ enable → │
│  doc    │    │ -plans  │    │ disabled│    │ override│    │ live     │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └──────────┘
     │              │              │              │               │
     v              v              v              v               v
  Bounded       Implementation  New feature    Tests use       Feature is
  Context       plan with      code behind    ConfigService   toggled ON
  design doc    gate steps     gate decorator override=false   for dev
```

### 7.2 Testing Strategy (per Test Strategy doc)

| Layer | Tool | Scope |
|-------|------|-------|
| Domain unit | Jest | Entities, value objects, domain logic — fast, no deps |
| Application | Jest | Use case orchestration, port mocking |
| Integration | Jest + Test DB | Repository, outbox/inbox, transactions |
| Contract | Jest + supertest | API response shape, error codes |
| E2E | Jest + supertest | Critical business flows only |

### 7.3 Feature Gate in Tests

```ts
// Test uses in-memory config override
beforeEach(async () => {
  const module = await Test.createTestingModule({
    // ...
  })
    .overrideProvider(ConfigService)
    .useValue({
      get: (key: string) => {
        if (key === 'app.features.userProfile') return true; // explicitly enable
        return defaultConfig.get(key);
      },
    })
    .compile();
});
```

---

## 8. Implementation Phases

### Phase 1 — Foundation + User Context (Current)

**Tasks decomposed into:**

#### 1A — Docker Setup
- docker-compose.yml with PostgreSQL
- Feature gating env vars in .env.example
- Update CLAUDE.md with Docker commands

#### 1B — Feature Gate System
- FeatureGateService with env-driven config
- @Gate decorator + metadata key
- GateGuard (global, checks API_LOCKED + routes to @Gate)
- FeatureGateModule registered in SharedAdaptersModule
- Tests for gate disabled → 503, gate enabled → pass-through

#### 1C — TenantContext + RequestContext
- Tenant module: extract tenantId from JWT/header
- RequestContext middleware: requestId + correlationId
- Register in app.module.ts

#### 1D — User Context (Bounded Context)
Per `docs/User Context — Backend Specification.md`:
- Domain: UserProfile aggregate, UserIdentity, UserSession entities and VOs
- Application: GetProfile, UpdateProfile, ChangePassword, RefreshToken use cases
- Adapters: controller, repository, DTOs
- Module: user.module.ts with proper port wiring
- All routes gated behind `@Gate('user-profile')`

### Phase 2 — Product Catalog Context

- Docker: no new services
- Catalog aggregate with tree structure
- Product aggregate with status lifecycle
- Product attributes + media entities
- Full CRUD + search

### Phase 3 — Shipping Context

- Address management (CRUD, default)
- Shipment lifecycle
- COD tracking

### Phase 4+ — Commerce Flow

- Cart → Order → Inventory → Payment
- Requires Outbox/Inbox pattern
- Saga for checkout flow

---

## 9. Exception Hierarchy — Per Layer, Each Stays in Its Layer

Each architectural layer has its own exception types. Exceptions never cross layers directly — the `GlobalExceptionFilter` maps them at the boundary.

### 9.1 Layer Exceptions

| Layer | Exception Base | Inherits From | Where Thrown | Purpose |
|-------|---------------|---------------|-------------|---------|
| **Domain** | `DomainError` | `Error` (pure TS) | Entities, VOs, domain services | Business rule violations (e.g. Email already exists, Password too weak) |
| **Application** | `ApplicationError` | `Error` (pure TS) | Use cases, handlers | Orchestration errors (e.g. resource not found, operation not allowed) |
| **Presentation** | `HttpException` | NestJS `HttpException` | Controllers, guards | HTTP-level errors (e.g. BadRequestException, UnauthorizedException) |
| **Infrastructure** | `InfrastructureError` | `Error` | Repositories, adapters | Technical errors (e.g. database connection failed, third-party API timeout) |

### 9.2 Domain Exception Hierarchy (pure TypeScript — `shared/domain/errors/`)

```
DomainError (base)
  ├── NotFoundError         # Entity not found by ID
  ├── ValidationError       # VO construction failed, invariant violated
  ├── UnauthorizedError     # Not allowed to access resource
  └── ConflictError         # Duplicate email, duplicate slug, etc.
```

- **Always extends `Error` directly** — no NestJS dependency.
- **Thrown only by domain layer** — entities, value objects, domain services.
- **`name` property = constructor name** (set in `DomainError` base), used by filter for HTTP mapping.

### 9.3 Application Exception Hierarchy (pure TypeScript — `shared/application/errors/`)

```
ApplicationError (base)
  ├── UseCaseError          # Generic use case failure
  ├── ResourceNotFoundError # Requested aggregate not found in use case
  ├── OperationForbiddenError # User lacks permission for this operation
  └── InvalidInputError     # Input failed application-level validation
```

- **Pure TypeScript** — no NestJS dependency.
- **Thrown by use cases** for orchestration-level failures not covered by domain rules.
- Example: "User profile not found" after successfully validating the user exists.

### 9.4 Infrastructure Exception Hierarchy (`shared/adapters/errors/`)

```
InfrastructureError (base)
  ├── DatabaseError         # Connection failed, query timeout, constraint violation
  ├── ExternalServiceError  # Third-party API returned error
  ├── CacheError            # Redis/memcache unavailable
  └── ConfigurationError    # Missing or invalid config value
```

- May depend on NestJS or external packages (it's in infrastructure layer).
- **Never caught in application/domain** — let it bubble to the filter.
- Filter maps `InfrastructureError` → 500 Internal Server Error.

### 9.5 HTTP Exception Mapping (filter boundary — `shared/application/filters/`)

```
GlobalExceptionFilter.catch(exception)
  │
  ├── DomainError             → map name → HTTP status (400/401/404/500)
  ├── ApplicationError        → map name → HTTP status (400/403/404/500)
  ├── InfrastructureError     → 500 Internal Server Error
  ├── HttpException           → pass through (as-is)
  ├── GateException           → 503 Service Unavailable
  └── unknown                 → 500 Internal Server Error
```

Detailed mapping:

| Exception | HTTP Status | Response Code |
|-----------|-------------|---------------|
| `DomainError.NotFoundError` | 404 | `NOT_FOUND` |
| `DomainError.ValidationError` | 400 | `VALIDATION_ERROR` |
| `DomainError.UnauthorizedError` | 401 | `UNAUTHORIZED` |
| `DomainError.ConflictError` | 409 | `CONFLICT` |
| `ApplicationError.ResourceNotFoundError` | 404 | `RESOURCE_NOT_FOUND` |
| `ApplicationError.OperationForbiddenError` | 403 | `FORBIDDEN` |
| `ApplicationError.InvalidInputError` | 400 | `INVALID_INPUT` |
| `InfrastructureError.*` | 500 | `INTERNAL_ERROR` |
| `GateException` | 503 | `FEATURE_DISABLED` |
| `HttpException` (any) | as-is | as-is |

### 9.6 Standard API Error Response Format

```json
{
  "statusCode": 503,
  "code": "FEATURE_DISABLED",
  "message": "This feature is currently disabled",
  "feature": "user-profile",
  "timestamp": "2026-07-05T12:00:00.000Z",
  "path": "/api/me"
}
```

All errors follow this shape. `code` is always a machine-readable constant. `message` is human-readable. Only DomainError and ApplicationError may carry additional domain-specific fields (e.g. `entityName`, `id`).

---

## 10. Risk & Mitigation

| Risk | Mitigation |
|------|-----------|
| Feature gate bypass | GateGuard runs before all route handlers. Cannot be accidentally skipped. |
| Cross-context coupling | Ports & Adapters enforce boundaries. No direct imports across contexts. |
| Build broken during multi-feature dev | Feature gates disabled by default. Code merged but inactive. |
| Tenant leak | TenantContext injected at request boundary. Repository filter is mandatory. |

---

## 11. Spec Self-Review

- ✅ No placeholders or TODOs
- ✅ Architecture matches existing auth module pattern
- ✅ Feature gate system defined at shared kernel level
- ✅ Docker scope clear (PostgreSQL only)
- ✅ Bounded context ordering defined
- ✅ Development workflow with gates documented
- ✅ Error response format defined
- ✅ Test strategy with gate override documented
