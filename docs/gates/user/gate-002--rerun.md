# Gate: user-profile

## Gate Run: 002
**Date:** 2026-08-06
**Feature:** user-profile (User Context — Phase 1D)
**Gate Type:** rerun

## Decision Context
- **Feature:** User profile management (GET /me, PATCH /me/profile, POST /auth/change-password)
- **Status:** Re-audit of gate-001, which recorded PASS on unverified claims
- **Dependencies:** Auth BC (JwtAuthGuard), RequestContext, FeatureGate config
- **Trigger:** Documentation audit found gate-001 evidence did not match repository state

## Why this rerun exists

gate-001 recorded `PASS` with "Implementation complete, build passes (`pnpm build` — 0 errors)"
and "Issues Found: None". Re-verification on a clean install contradicts all three claims:

| gate-001 claim | Verified result |
|----------------|-----------------|
| `pnpm build` — 0 errors | FAILED — 4 × TS2307, `uuid` imported but never declared in `package.json` |
| Unit tests written | `user-profile.spec.ts` sat in `domain/` importing `../entities/*` — suite never compiled |
| Use cases implemented (GetProfile, UpdateProfile, **ChangePassword**) | ChangePassword has no implementation behind it — see blocker below |
| Issues Found: None | Blocker below prevents the application from starting at all |

## Criteria
- [x] Domain entities created (UserProfile, UserSession)
- [x] GetProfile / UpdateProfile use cases implemented
- [ ] **ChangePassword use case implemented** — shell only, no adapter exists
- [x] Controller wired with @Gate('userProfile') + JwtAuthGuard
- [x] Event handler (UserRegistered → auto-create profile)
- [x] Unit tests compile and pass (fixed in PR #1 — 16/16 green)
- [x] Build passes (fixed in PR #1 — 0 errors)
- [x] Feature flag env var defined = FEATURE_USER_PROFILE
- [ ] **Application bootstraps** — fails, see blocker

## Decision
FAIL
**Reason:** `AUTH_PASSWORD_PORT` is injected but never provided, so the Nest container
cannot construct `UserModule`. The application does not start. The feature flag
`FEATURE_USER_PROFILE` is currently `true` in `.env.example`, which advertises a feature
whose module prevents boot.

## Evaluation Result

### Outcome
**Gate decision:** FAIL
**Action:** Do not treat user-profile as enabled. Resolve the blocker, then rerun as gate-003.

### Blocker — application cannot bootstrap

`ChangePasswordUseCase` declares:

```ts
@Inject(AUTH_PASSWORD_PORT) private readonly authPassword: IAuthPasswordPort
```

No provider anywhere in `src/` binds that token — `grep -rn "provide: AUTH_PASSWORD_PORT" src/`
returns nothing. `UserModule` lists `ChangePasswordUseCase` in `providers` but supplies no
binding for the port and imports no module that exports one. Nest instantiates singleton
providers eagerly, so this throws during `NestFactory.create(AppModule)`:

```
Nest can't resolve dependencies of the ChangePasswordUseCase (?).
Please make sure that the argument "AUTH_PASSWORD_PORT" at index [0] is available.
```

Reproduced against the compiled output in `dist/`.

The port is unimplementable as currently designed: `IAuthPasswordPort.changePassword()`
has no counterpart in the Auth BC — `AuthService` exposes `register`, `login`,
`validateUser`, `getProfile`, and a private `generateTokens`, but no password-change
operation. So `POST /auth/change-password` was never implemented end to end, despite
gate-001 listing it as a completed use case.

Resolving this is feature work, not a wiring fix. It needs a decision on scope:
implement password change in the Auth BC and adapt it into the User BC, or withdraw
the endpoint and its port until it is scheduled.

### Evidence
- Build: 0 errors (after PR #1)
- Tests: 5/5 suites, 16/16 tests (after PR #1; was 3/5 suites, 11/12 tests)
- Lint: 0 non-formatting errors (after PR #1); 146 `prettier/prettier` errors remain repo-wide
- Bootstrap: FAILS — unresolvable `AUTH_PASSWORD_PORT`
- Endpoints: 3/3 carry `@Gate('userProfile')`

### Issues Found
1. **Blocker** — `AUTH_PASSWORD_PORT` unresolvable; application does not start.
2. **Feature never implemented** — `POST /auth/change-password` has a use case shell and a
   port interface, but no adapter and no Auth-side operation.
3. `get-profile.use-case.ts:14` and `update-profile.use-case.ts:15` throw bare
   `new Error('Profile not found')`. `GlobalExceptionFilter` only maps `DomainError`
   subclasses by name, so a missing profile returns **500 instead of 404**.

### Next Step
Decide the scope of change-password (implement, or withdraw the endpoint + port), then
rerun as gate-003. Until the application bootstraps, `FEATURE_USER_PROFILE=true` should
not be treated as a live feature.
