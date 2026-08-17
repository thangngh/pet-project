# Memory Index

The source-of-truth index for `.claude/memory/`. One entry per memory file.

`CLAUDE.md`'s session pipeline has required this index since 2026-07-05. It did
not exist until 2026-08-17 (spec-004 §3), and neither did any memory file —
eight checkpoints referenced a pipeline whose first stage had nothing to load.
Everything below was written from what specs 001–004 turned up.

**On writing a memory:** it earns a file when it would cost real time to
rediscover *and* would not be found by reading the code. A fact the code states
plainly belongs in a comment next to that code, not here.

## Project

| Memory | Description |
|---|---|
| [repository-must-not-clear-events](./repository-must-not-clear-events.md) | A repository clearing an aggregate's events drops every domain event before publication — silently, with 201 responses |
| [eventbus-is-fire-and-forget](./eventbus-is-fire-and-forget.md) | `@nestjs/cqrs` `EventBus.publish` returns void and swallows handler errors; it cannot back a retrying outbox |
| [typeorm-per-context-traps](./typeorm-per-context-traps.md) | Named data source shutdown, `3F000` on first migration, and index drift on generate |
| [jwt-iat-one-second-granularity](./jwt-iat-one-second-granularity.md) | Same payload in the same second produces identical tokens; refresh rotation collapsed on it |
| [feature-rbac-is-not-optional](./feature-rbac-is-not-optional.md) | With `FEATURE_RBAC` off, eleven admin endpoints accept any authenticated caller |
| [liveness-probes-must-not-fail-on-state](./liveness-probes-must-not-fail-on-state.md) | `/health` stays 200 for maintenance mode and a stuck outbox — a restart fixes neither |

## Feedback

| Memory | Description |
|---|---|
| [jest-check-suites-not-just-tests](./jest-check-suites-not-just-tests.md) | A suite that fails to compile contributes zero tests, so a rising pass count can hide a broken file |

## Reference

| Memory | Description |
|---|---|
| [verification-standard](./verification-standard.md) | Mark every claim built or planned; never record an unverified criterion as a pass |
| [local-postgres-without-docker](./local-postgres-without-docker.md) | No Docker daemon here, but PostgreSQL 16 is installed — `initdb` rather than mock |

## Checkpoints

Session and request snapshots live in [`checkpoints/`](./checkpoints/), and are
not indexed here — they are dated records, not recallable facts. Note that
`checkpoint-2026-07-10-01` carries a correction: it called Phase 3 "Shipping",
and the roadmap defines Phase 3 as Cart + Pricing.
