# Gate: user-profile

## Gate Run: 003
**Date:** 2026-08-06
**Feature:** user-profile (User Context — Phase 1D)
**Gate Type:** final-enable

## Decision Context
- **Feature:** User profile management (GET /me, PATCH /me/profile, POST /auth/change-password)
- **Status:** gate-002 blocker resolved; change-password implemented end to end
- **Dependencies:** Auth BC (JwtAuthGuard, AUTH_SERVICE port), RequestContext, FeatureGate config

## Criteria
- [x] Domain entities created (UserProfile, UserSession)
- [x] GetProfile / UpdateProfile use cases implemented
- [x] **ChangePassword implemented end to end** — was a shell with no adapter at gate-002
- [x] Controller wired with @Gate('userProfile') + JwtAuthGuard
- [x] Event handler (UserRegistered → auto-create profile)
- [x] Unit tests compile and pass
- [x] Build passes
- [x] **Container resolves AUTH_PASSWORD_PORT** — was the gate-002 blocker
- [x] Profile lookups return 404 rather than 500
- [x] New password validated at the DTO boundary
- [x] Feature flag env var defined = FEATURE_USER_PROFILE

## Decision
PASS
**Reason:** The gate-002 blocker is resolved and change-password now exists end to end.
The remaining gap is integration-level verification, recorded below rather than claimed.

## Evaluation Result

### Outcome
**Gate decision:** PASS
**Action:** `FEATURE_USER_PROFILE=true` is now backed by working code.

### How the blocker was resolved

`IAuthPasswordPort` had no implementation and no counterpart in the Auth BC.
`AuthService.changePassword()` now verifies the current password with bcrypt `compare`,
rejects inactive accounts, hashes the new password and persists through the existing
repository port. `AuthPasswordAdapter` in the User BC's outbound adapters satisfies
`IAuthPasswordPort` by delegating to the `AUTH_SERVICE` port, so the User BC still
depends on no Auth domain type. `UserModule` binds the token and imports `AuthModule`,
which already exported `AUTH_SERVICE`.

`AuthModule` does not import `UserModule`, so no cycle is introduced — checked before wiring.

### Evidence
- Build: 0 errors
- Tests: 9 suites, 46 tests, all passing (was 5 suites / 16 tests at gate-002)
- Lint: 0 non-formatting errors
- DI: `ChangePasswordUseCase` → `AuthPasswordAdapter` → `AUTH_SERVICE` resolves against
  compiled `dist/`, and `execute()` reaches `AuthService.changePassword` with the
  arguments intact
- Endpoints: 3/3 carry `@Gate('userProfile')`

### Issues Found
1. **Not verified against a running process.** No Docker daemon is available in this
   environment, so PostgreSQL could not be started and `NestFactory.create(AppModule)`
   was never executed against a real database. The blocker was proved fixed at the DI
   level, which is where it failed. A full boot should still be confirmed once a
   database is reachable.
2. **No integration test for the change-password flow.** Unit tests cover the use case
   and the adapter with a mocked `AUTH_SERVICE`; the bcrypt comparison and persistence
   inside `AuthService.changePassword` are not exercised end to end.
3. `Password`'s `isStrongPassword` rule is unreachable in practice. Both `register` and
   `changePassword` construct `new Password(hash, true)`, and the `hashed` branch skips
   validation. Strength is enforced by `RegisterDto` and `ChangePasswordDto` instead, so
   behaviour is correct, but the VO rule is dead code.

### Next Step
Confirm a full application boot against a live database, then add an integration test for
change-password.
