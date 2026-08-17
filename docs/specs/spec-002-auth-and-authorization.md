# spec-002 — Auth and authorization actually enforce something

**Implements** D17, D5 (steps 2–3), D6, D7, D8, D16 from `docs/decision.md`
**Closes** F05, F06, F07, F08, F15, F22 from `docs/audit/audit-2026-08-17.md`
**Depends on** spec-001 — none of this is testable without a database, and D8
writes to the `auth` schema that spec-001 §4.6 creates

## Goal

Today the system has authentication and no authorization: eleven admin-only
endpoints enforce nothing, any password is accepted, and a session cannot be
extended or revoked. Each of those is a component that exists and is switched
off.

Turn them on, in an order where no step leaves the system worse than it found
it.

## Definition of done

- [ ] `@Roles('admin')` denies a non-admin on all eleven endpoints
- [ ] An admin exists and can be created by a documented, authorised route
- [ ] `POST /api/v1/auth/register` with `"a"` as the password returns 400 — from
      the value object, not only the DTO
- [ ] A disabled feature returns **503** with `code: "FEATURE_DISABLED"` and the
      feature name; `API_LOCKED=true` does the same for every endpoint
- [ ] `POST /api/v1/auth/refresh` rotates the pair; the old refresh token is
      rejected afterwards
- [ ] `POST /api/v1/auth/logout` makes the session's refresh token unusable
- [ ] One role vocabulary in the codebase

## The order is the design

Every step here is individually easy and at least two of them are actively
harmful in the wrong order.

```
1. D17  reconcile the role vocabulary
        └── or @Roles(ROLE_ADMIN) denies everyone, silently
2. D5.2 a way to create an admin
        └── or step 4 locks 11 endpoints against everybody
3. D6   password strength enforced in the value object
        └── before RBAC, because the first admin's password is created here
4. D5.3 FEATURE_RBAC=true
        └── only now is this safe: escalation closed (done), admin exists,
            vocabulary agrees
5. D7   gate 503        ── independent
6. D8   refresh tokens  ── independent
7. D16  move change-password to AuthController ── independent, cleanup
```

Steps 5–7 can be done in any order or in parallel. Steps 1–4 cannot.

---

## 1. One role vocabulary (D17 → F22)

`role.constants.ts` becomes the domain's spelling:

```ts
export const ROLE_ADMIN = 'admin';
export const ROLE_USER = 'user';
```

`ROLE_SERVICE` is deleted — no `UserRole` admits it and no service accounts
exist. `UserRole` is redefined in terms of the constants so a third spelling
cannot appear:

```ts
export type UserRole = typeof ROLE_ADMIN | typeof ROLE_USER;
```

All eleven `@Roles('admin')` call sites use `@Roles(ROLE_ADMIN)`.

`roles.guard.spec.ts` currently passes `['ADMIN']` on both sides of its own
assertion, which is why nothing caught this. It is corrected to the real
vocabulary, and gains a case that would have caught the original defect: a
guard configured from the constants must admit an identity built from a JWT
claim.

### Verification

- `grep -ri "'ADMIN'" src` returns nothing.
- The guard test fails if the constants and `UserRole` diverge again.

---

## 2. Creating an admin (D5 step 2 → F05)

Nothing can create an admin now that registration cannot (D5 step 1, done).
Something must, before RBAC is switched on.

### Options

| | Approach | Verdict |
|---|---|---|
| A | Seed script: create an admin from environment variables if none exists | Explicit, idempotent, runs in CI and locally |
| B | Promote endpoint, admin-only | Needed eventually; useless as the first admin, since it needs an admin |
| C | First registered user becomes admin | Surprising, and a race on an open endpoint |

### Decision

**A now, B in the same slice.** The seed solves the bootstrap; the endpoint
solves the ongoing case, and B is safe once A exists.

- `pnpm seed:admin` — reads `ADMIN_EMAIL` and `ADMIN_PASSWORD`, creates the
  user if absent, exits 0 if already present. Refuses to run if
  `ADMIN_PASSWORD` fails the strength rule from §3.
- `POST /api/v1/auth/users/:id/role` — `@Roles(ROLE_ADMIN)`, body
  `{ role }` validated with `@IsIn([ROLE_ADMIN, ROLE_USER])`. The runtime
  guard the removed field never had.

### Verification

- Seed twice; the second run changes nothing and exits 0.
- Seed with a weak `ADMIN_PASSWORD`; it refuses.
- A non-admin calling the promote endpoint gets 403.

---

## 3. Password strength where it cannot be skipped (D6 → F06, F15)

`Password` validates only when `hashed` is false, and both call sites pass
`true` — so the rule never runs. spec-001's validation pipe restores the DTO
half, but a DTO is a presentation concern and `AuthService` can build a `User`
without one.

### Change

In `register` and `changePassword`, construct the value object from the
plaintext first, then hash:

```ts
const password = new Password(input.password);           // throws ValidationError
const hashed = new Password(await hash(password.getValue(), 10), true);
```

`hashed: true` keeps its real meaning — rehydrating a stored hash, which must
not be re-validated.

Two checks, deliberately: the DTO gives a good 400 at the boundary, the value
object makes the rule unskippable for any future caller.

### Verification

- Unit: `new Password('a')` throws; `new Password('<bcrypt hash>', true)` does
  not.
- Unit: `AuthService.register` rejects a weak password even when called
  directly, with no DTO involved. That is the case the DTO cannot cover.
- e2e: register with `"a"` → 400.

---

## 4. Turn RBAC on (D5 step 3 → F05)

`FEATURE_RBAC=true` in `.env.example`, and the flag documented as required
rather than optional.

Only now is this safe: escalation is closed (done), an admin exists (§2), and
the vocabulary agrees (§1).

### Verification

- e2e: a `user` token gets 403 from `POST /api/v1/catalogs`; an `admin` token
  gets 201.
- e2e: the same for one product write, so both controllers are covered.
- The eleven endpoints are enumerated in the test, not sampled — a missing
  `@Roles` is exactly the kind of gap that a sample misses.

---

## 5. A disabled feature returns 503 (D7 → F07)

`GateException extends Error`, so `GlobalExceptionFilter` falls through to its
generic branch and returns 500 "Internal server error". Maintenance mode
presents as a total failure, which is the opposite of its purpose.

### Change

```ts
export class GateException extends HttpException {
  constructor(public readonly feature: string) {
    super(
      { code: 'FEATURE_DISABLED', feature, message: `Feature '${feature}' is currently disabled` },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
```

The filter needs no change — its `HttpException` branch already carries the
status and body through. Note the filter flattens the response to
`{ statusCode, message, timestamp, path }`, so it must be extended to preserve
`code` and `feature`, or the client still cannot distinguish a disabled feature
from any other 503.

### Verification

- e2e: `FEATURE_PRODUCT_CATALOG=false` → `GET /api/v1/catalogs/tree` returns 503
  with `code: "FEATURE_DISABLED"` and `feature: "productCatalog"`.
- e2e: `API_LOCKED=true` → any endpoint returns 503; `/health` still returns 200,
  because a maintenance mode that fails liveness probes takes the process down.

---

## 6. Refresh tokens (D8 → F08)

The machinery is already built and has never been called: `UserSession` has
`refreshTokenHash`, `expiresAt`, `revokedAt`, `revoke()` and `rotate()`; the
repository has `findByRefreshTokenHash` and `revokeByUserId`. spec-001 §4.6
moves it into the Auth context, where the code that needs it lives.

### Changes

1. `login` and `register` create a session: store **a hash of the refresh
   token**, never the token. It is a credential; the argument is the one for
   hashing passwords.
2. `POST /api/v1/auth/refresh` — verify the JWT signature, look the hash up,
   reject if missing, revoked or expired, then **rotate**: revoke the old
   session, issue a new pair, store the new hash.
3. `POST /api/v1/auth/logout` — revoke the current session.
4. Refresh tokens gain a `type: 'refresh'` claim, and the access-token path
   rejects a token carrying it. Without that separation a refresh token is a
   15-minute access token with a 7-day life.

### Why rotation rather than a long-lived token

A stolen refresh token is indistinguishable from the real one. Rotation makes
reuse *detectable*: the second use of a rotated token is a signal, and the
correct response is to revoke every session for that user
(`revokeByUserId` — already implemented).

### Verification

- e2e: refresh returns a new pair; the old refresh token then returns 401.
- e2e: logout, then refresh → 401.
- e2e: a refresh token presented as an access token → 401.
- Unit: the stored value is never equal to the issued token.

---

## 7. `change-password` moves to `AuthController` (D16)

The path stays `POST /api/v1/auth/change-password`, so no client is affected.
It moves from `UserController` to `AuthController`, which already holds every
other `/auth/*` route and already owns the operation.

`AUTH_PASSWORD_PORT`, `AuthPasswordAdapter` and `ChangePasswordUseCase` — all
added in PR #2 solely to reach across the boundary — are deleted. The
controller calls `AUTH_SERVICE` directly, as `AuthController` already does.

Under D4 this also removes a User→Auth module dependency, which matters more
now that the contexts have separate pools.

### Verification

The existing `change-password.spec.ts` is rewritten against `AuthService`; the
e2e path is unchanged, which is the point.

---

## Task order

| # | Task | Verified by |
|---|------|-------------|
| 1 | Role vocabulary; fix `roles.guard.spec.ts` (§1) | `grep` finds no uppercase role; guard test fails on divergence |
| 2 | `seed:admin` + promote endpoint (§2) | Idempotent re-run; 403 for non-admin |
| 3 | Password strength in the value object (§3) | Direct-call test with no DTO |
| 4 | `FEATURE_RBAC=true` (§4) | All eleven endpoints enumerated |
| 5 | `GateException` → 503, filter preserves `code` (§5) | Gate and `API_LOCKED` e2e |
| 6 | Sessions on login/register; refresh; logout (§6) | Rotation and reuse e2e |
| 7 | Move `change-password`; delete the port (§7) | Path unchanged, suite green |

## Risks

| Risk | Likelihood | Handling |
|---|---|---|
| RBAC locks out everyone because no admin exists | **high if ordered wrong** | §2 before §4; §4's acceptance requires an admin token succeeding |
| The uppercase constants come back via a stale import | medium | `UserRole` derived from the constants, so a divergence fails to compile |
| Existing users' weak passwords now fail login | low | §3 validates on write, not on `compare`; existing hashes are unaffected |
| Filter flattening drops `code` and `feature` | **medium** | Called out in §5; the e2e asserts the body, not just the status |
| Refresh rotation breaks a client mid-flight | none today | No client exists (D11) |

## Gate

`docs/gates/auth/gate-001--enforce.md` on completion. Evidence from CI, per
spec-001 §5 — a claim that "RBAC works" verified locally is the exact shape of
claim this audit was called to check.
