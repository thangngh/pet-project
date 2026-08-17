# Gate: durable-cross-context-delivery

## Gate Run: 002

**Date:** 2026-08-17
**Feature:** spec-003 — durable cross-context delivery
**Gate Type:** create

## Decision Context

- **Feature:** A transactional outbox per producing context, and a subtree
  cascade when a catalog is archived
- **Status:** Implemented; verified against PostgreSQL 16, including a kill test
- **Dependencies:** spec-001 (per-context pools decide the outbox's shape); D9, D10
- **Spec:** `docs/specs/spec-003-durable-cross-context-delivery.md`

## Criteria

- [x] An event is written to its context's `outbox_messages` in the same
      transaction as the aggregate
- [x] A killed process between write and dispatch loses nothing
- [x] Delivering the same message twice leaves the same state
- [x] Archiving a parent catalog archives every descendant and their products
- [x] Undelivered messages are visible rather than silent

## Decision

**PASS.**

**Reason:** the kill test passed — the property everything else in this slice
is plumbing around.

---

## Evaluation Result

### Outcome

**Gate decision:** PASS
**Action:** spec-004, the last slice: make the records describe the system

### Evidence

**The kill test**, run by hand against PostgreSQL 16, because it cannot be
made deterministic inside jest:

| Step | Observed |
|---|---|
| Register with `OUTBOX_POLLING=false` | 201 |
| `auth.users` | 1 row |
| `auth.outbox_messages` | `UserCreatedEvent`, `dispatchedAt = NULL` |
| `user.user_profiles` | 0 rows |
| `kill -9` the process | gone |
| Start a new process, polling on | — |
| `user.user_profiles` | 1 row, `status = active` |
| the message | `dispatchedAt = 2026-08-17 09:24:37+00` |

Before this slice the same sequence lost the event permanently, and nothing
recorded that one was owed. The middle rows are the point: an account that
exists with a *recorded debt* is a state the old code could not represent.

**The rollback test** (`test/outbox.e2e-spec.ts`): a message written inside a
transaction that then throws leaves no row. This is the test that decides
whether the outbox is worth building — an enqueue outside the aggregate's
transaction survives a failed write, and the consumer acts on something that
never happened.

**Other e2e evidence:** enqueue shares the aggregate's transaction manager;
delivery after the fact; a second tick delivers nothing; a forced redelivery
leaves one profile; a three-level tree archives products two levels down with
one message per catalog; an unhandled event stays undispatched with
`attempts = 1` and the reason recorded.

**Health:** `ok` when drained; with one stuck message,
`{"status":"degraded","outbox":{"catalog":{"undispatched":1,"stale":1,"abandoned":1,...}}}`.

**Suites:** 125 unit tests (20 suites), 53 e2e (6 suites), build and lint clean.

### Issues Found

**1. The spec's dispatch design could not work, and would have failed
silently.**

spec-003 §2 says to publish outbox messages to the existing `EventBus`.
`@nestjs/cqrs`'s `EventBus.publish` returns `void`: it pushes onto an rxjs
subject and handlers run detached, with their errors swallowed into an
`UnhandledExceptionBus` nothing subscribes to. Built that way, every message
would be marked delivered whether or not the handler succeeded, and
`attempts`, the backoff and the give-up threshold would never once fire.

The outbox would have looked complete, passed a happy-path test, and lost
messages exactly when it was supposed to save them. Handlers now self-register
into an `IntegrationEventDispatcher` the poller awaits.

This is worth stating plainly: the spec was written by reading the code, and
this is the second time in three slices that the reading was wrong in a way
only running it exposed.

**2. A deliberate deviation on health.** spec-003 §4 asks for "a failing
health check". A stuck outbox reports `status: degraded` in the body and still
answers HTTP 200, because `/health` is the liveness probe: a restart cannot
unstick an outbox — the messages are in the database, not in memory — so
failing liveness would flap. Same mistake as maintenance mode failing liveness
(spec-002 §5). A readiness probe or an alert reads `status`.

**3. Two tables, not four.** The spec says one `outbox_messages` per context
schema. `user` and `product` publish nothing, and a table nobody writes is the
"exists, connected to nothing" shape this whole effort exists to remove.
Adding one later is a migration, and a context that starts publishing without
one fails loudly — `relation does not exist` — not silently.

### Consequence worth naming

A user profile is now **eventually consistent**. `GET /me` immediately after
registering can return 404 until the poller runs. That is what durable
delivery costs, and it is a real change for any future client. The
auth-session e2e was updated to read Auth's own profile endpoint rather than
`/me`, because that test is about tokens.

### Not done

`UserSession.rotate()` remains unused (noted in gate-001 for auth). spec-004's
pass over dead code is where it gets a decision.

### Next Step

spec-004. Every figure in this gate came from a local run plus CI on the
preceding commit; CI on this commit is the confirmation.
