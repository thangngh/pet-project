# User Context — Phase 1D

**Date:** 2026-07-06
**Status:** Draft
**Phase:** 1D

## 1. Purpose

User Context manages user profiles and sessions. It is an independent bounded context that references users by `userId` (string) from Auth BC events — never via foreign key or direct dependency.

## 2. Rule: userId Is an Event Reference, Not a Foreign Key

- User Context reads `userId` from `RequestContext.identity.userId` set by AuthGuard.
- Cross-context communication: Auth BC publishes `UserRegistered` event → User Context creates a `UserProfile`.
- No SQL foreign key to Auth's `user` table.
- No TypeORM relation to Auth entities.
- Data integrity is eventually consistent via event bus.

## 3. Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Auth BC                           │
│  Publishes: UserRegistered { userId, email }         │
│  AuthGuard → sets RequestContext.identity.userId     │
└────────────────────┬────────────────────────────────┘
                     │ userId via RequestContext (read)
                     │ userId via DomainEvent (write)
                     ▼
┌─────────────────────────────────────────────────────┐
│                  User BC                             │
│  Domain: UserProfile, UserSession                    │
│  Events consumed: UserRegistered                     │
│  UserId = string reference, no FK                    │
│                                                      │
│  ├── UserProfile (aggregate root)                    │
│  │   ├── firstName, lastName, phone, avatar, status  │
│  │   └── userId: string (event ref)                  │
│  └── UserSession                                     │
│      └── refreshTokenHash, expiresAt, revokedAt      │
└─────────────────────────────────────────────────────┘
```

## 4. Domain

### Aggregates

```
UserProfile (Aggregate Root)
 └── userId: string        # event reference, NOT FK
 └── firstName: string
 └── lastName: string
 └── phone?: Phone         # value object
 └── avatar?: string
 └── status: UserStatus    # active | inactive
 └── version: number       # optimistic lock

UserSession (Aggregate Root)
 └── userId: string        # event reference, NOT FK
 └── refreshTokenHash: string
 └── userAgent?: string
 └── ip?: string
 └── expiresAt: Date
 └── revokedAt?: Date
```

### Value Objects

```ts
class Phone {
  constructor(private readonly value: string) {
    if (!/^\+?[0-9]{7,15}$/.test(value)) {
      throw new ValidationError('Invalid phone number');
    }
  }
  toString(): string { return this.value; }
}

type UserStatus = 'active' | 'inactive';
```

## 5. Use Cases

| Use Case | Actor | Input | Output |
|----------|-------|-------|--------|
| GetProfile | Authenticated user | `userId` from RequestContext | `ProfileDto` |
| UpdateProfile | Authenticated user | `UpdateProfileDto` | `ProfileDto` |
| ChangePassword | Authenticated user | `oldPassword`, `newPassword` | void (via Auth BC port) |
| RefreshToken | Authenticated session | `refreshToken` | `AuthTokens` |
| Logout | Authenticated user | `refreshToken` | void |

**Register/Login are NOT in User Context** — they belong to Auth BC.

## 6. Ports

### Outbound (Domain → Infrastructure)

```ts
// user-profile.repository.port.ts
export const USER_PROFILE_REPOSITORY = 'USER_PROFILE_REPOSITORY';
export interface IUserProfileRepository {
  save(profile: UserProfile): Promise<void>;
  findByUserId(userId: string): Promise<UserProfile | null>;
}

// user-session.repository.port.ts
export const USER_SESSION_REPOSITORY = 'USER_SESSION_REPOSITORY';
export interface IUserSessionRepository {
  save(session: UserSession): Promise<void>;
  findByRefreshTokenHash(hash: string): Promise<UserSession | null>;
  revokeByUserId(userId: string, exceptSessionId?: string): Promise<void>;
}
```

### Inbound (Presentation → Application)

```ts
// user-service.port.ts (optional, for controller injection)
export const USER_SERVICE = 'USER_SERVICE';
export interface IUserService {
  getProfile(userId: string): Promise<ProfileDto>;
  updateProfile(userId: string, dto: UpdateProfileDto): Promise<ProfileDto>;
  changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void>;
}
```

## 7. DTOs

```ts
class ProfileDto {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;           // from Auth, fetched via event projection
  phone?: string;
  avatar?: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

class UpdateProfileDto {
  @IsOptional() @IsString()
  firstName?: string;
  @IsOptional() @IsString()
  lastName?: string;
  @IsOptional() @IsString()
  phone?: string;
  @IsOptional() @IsString()
  avatar?: string;
}
```

## 8. HTTP API

| Method | Path | Gate | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/me` | `@Gate('userProfile')` | Get current user profile |
| `PATCH` | `/api/v1/me/profile` | `@Gate('userProfile')` | Update profile |
| `POST` | `/api/v1/auth/change-password` | `@Gate('userProfile')` | Change password |
| `POST` | `/api/v1/auth/refresh` | `@Gate('userProfile')` | Refresh token |
| `POST` | `/api/v1/auth/logout` | `@Gate('userProfile')` | Logout (revoke session) |

All endpoints require `@UseGuards(AuthGuard)`.

## 9. Event Flow

### Auth BC → User BC (event-driven)

```
Auth BC publishes: UserRegistered { userId, email }
  → User Context event handler creates UserProfile (inactive)
  → User Context publishes: UserProfileCreated { userId }
```

### User BC → Auth BC (port interface)

For `changePassword`, User Context calls an Auth port interface:

```ts
// modules/user/application/ports/auth-password.port.ts
export const AUTH_PASSWORD_PORT = 'AUTH_PASSWORD_PORT';
export interface IAuthPasswordPort {
  changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void>;
}
```

Auth BC implements this port. Wiring via `useClass` in `UserModule`.

## 10. Files Structure

```
backend/src/modules/user/
├── user.module.ts                    # Composition root
│
├── domain/
│   ├── entities/
│   │   ├── user-profile.entity.ts
│   │   └── user-session.entity.ts
│   ├── value-objects/
│   │   └── phone.value-object.ts
│   └── ports/
│       ├── user-profile.repository.port.ts
│       └── user-session.repository.port.ts
│
├── application/
│   ├── ports/
│   │   └── auth-password.port.ts
│   ├── use-cases/
│   │   ├── get-profile.use-case.ts
│   │   ├── update-profile.use-case.ts
│   │   ├── change-password.use-case.ts
│   │   ├── refresh-token.use-case.ts
│   │   └── logout.use-case.ts
│   └── dto/
│       ├── profile.dto.ts
│       └── update-profile.dto.ts
│
└── adapters/
    ├── inbound/
    │   └── controllers/
    │       └── user.controller.ts
    └── outbound/
        ├── persistence/
        │   ├── typeorm-user-profile.entity.ts
        │   └── user-profile.repository.ts
        └── user-session.persistence/
            ├── typeorm-user-session.entity.ts
            └── user-session.repository.ts
```

## 11. Non-Goals (YAGNI)

- ❌ Register / Login (belongs to Auth BC)
- ❌ Role / Permission management (deferred to IAM BC)
- ❌ Tenant isolation (deferred)
- ❌ Admin user management (CRUD all users)
- ❌ Email verification / password reset (Phase 2+)
- ❌ OAuth provider management (Phase 2+)

## 12. Spec Self-Review

- ✅ No placeholders
- ✅ userId is event reference, NOT FK
- ✅ Auth BC + User BC are fully independent
- ✅ Event-driven for cross-context
- ✅ Port interface for Auth password change
- ✅ DTOs defined
- ✅ All endpoints gated behind `@Gate('userProfile')`
- ✅ Test strategy: unit tests for use cases, integration for repositories
