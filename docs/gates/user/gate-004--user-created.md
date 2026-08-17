# Gate: user-profile

## Gate Run: 004
**Date:** 2026-08-17
**Feature:** user-profile — automatic profile creation on registration
**Gate Type:** rerun

## Decision Context
- **Feature:** Registering a user creates the matching profile
- **Status:** gate-001 recorded this handler as delivered; it never ran
- **Dependencies:** Auth context producer, shared event bus

## Criteria
- [x] Auth and User agree on one `UserCreatedEvent` class
- [x] The event carries primitives, so User imports no Auth domain type
- [x] Delivery proved through the real EventBus
- [x] `UserController` resolves — `RequestContextService` was unbound
- [x] Auth clears the aggregate's events after publishing

## Decision
PASS
**Reason:** The flow runs. It was recorded as working since gate-001 without
ever having done so.

## Evaluation Result

### Outcome
**Gate decision:** PASS
**Action:** Registration creates an active profile.

### Evidence
- Build: 0 errors
- Tests: 53 across 11 suites, all passing
- Publishing `UserCreatedEvent('u1', 'someone@example.com')` through the real
  `EventBus` saves a profile with that id, that email and status `active`

### What was wrong
Two classes named `UserCreatedEvent` existed: one in `auth/domain/entities/`
carrying `UserId` and `Email` value objects, which Auth published, and one in
`user/domain/entities/` carrying strings, which the handler subscribed to.
`@nestjs/cqrs` matches on metadata stamped onto the exact class passed to
`@EventsHandler`, so the published event matched no handler and registration
silently created no profile.

The name matching made this look correct in review. Had the classes matched,
the handler would still have been wrong: it passes `event.userId` and
`event.email` straight into `UserProfile.create(userId: string, email: string)`,
and the published event carried value objects, so the profile would have been
built from objects instead of strings.

One class now lives in `shared/adapters/event-bus/integration-events/` and
carries strings. `User.create()` converts its value objects at the boundary.

### Issues Found
1. **No outbox.** If the process dies between saving the user and the handler
   running, the account exists with no profile and nothing retries.
2. **Still no integration test** for registration end to end; requires a
   database.
3. `Password.isStrongPassword` remains unreachable, unchanged from gate-003.

### Next Step
Outbox, then an end-to-end registration test against a real database.
