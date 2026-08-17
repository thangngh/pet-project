# spec-003 — Durable cross-context delivery

**Implements** D9, D10 from `docs/decision.md`
**Closes** F09, F11 from `docs/audit/audit-2026-08-17.md`
**Depends on** spec-001 — the outbox is a database mechanism, and D4's per-context
pools decide its shape

## Goal

PR #3 made both cross-context flows deliver. They deliver in process, which
means they deliver *usually*.

```
save the aggregate ──✓── publish ──✗ process dies ──> nothing retries
                                                      nothing records the debt
```

Two known outcomes: products stay active under an archived catalog; an account
exists with no profile. Neither is detectable afterwards, because nothing
recorded that the event was owed.

D4 raises the stakes rather than lowering them. With one pool per context there
is no cross-context transaction available at all, so an outbox is not a
durability upgrade — it is the only correct way for two contexts to agree.

Second, smaller goal: archiving a catalog currently archives one level of
products. Catalogs are a tree.

## Definition of done

- [ ] An event published by a context is written to that context's
      `outbox_messages` in the same transaction as the aggregate
- [ ] A killed process between write and dispatch loses nothing — the event is
      delivered after restart
- [ ] Delivering the same message twice leaves the system in the same state
- [ ] Archiving a parent catalog archives every descendant catalog and every
      product beneath them
- [ ] Undelivered messages are visible — a stuck outbox is an observable
      condition, not a silent one

---

## 1. Subtree cascade (D9 → F09)

### The defect

`archiveByCatalogId(catalogId)` matches products by their own `catalogId`.
Archive a parent and its children stay `active`, with every product under them
still published. The tree endpoint nests to arbitrary depth, so one level is a
defect rather than a limit.

### Change

The Catalog context owns the tree, so it resolves it:

1. `ICatalogRepository` gains `findDescendants(id): Promise<Catalog[]>` — a
   recursive CTE in the adapter; the port stays ignorant of how.
2. `ArchiveCatalogUseCase` archives the catalog and every descendant, saving
   each and collecting each one's event.
3. One `CatalogDeletedEvent` per archived catalog. Consumers are unchanged —
   one event, one catalog id — and the Product context still knows nothing
   about trees.

Rejected: putting the tree walk in Product (it would need the catalog tree), or
carrying the id list in the event (it couples every consumer to the producer's
tree shape).

### Interaction with the outbox

A subtree of 50 catalogs emits 50 messages in one transaction. That is correct
and worth knowing: §2's batch size and the idempotence in §3 both have to
tolerate it.

The idempotence added in PR #3 — a second `archive()` collects nothing —
already makes a partial re-run safe.

### Verification

- Unit: a three-level tree archives all of it and emits one event per catalog.
- Unit: a catalog already archived inside the subtree is not re-emitted.
- Integration: products two levels down end up `archived`.

---

## 2. The outbox (D10 → F11)

### Shape

One `outbox_messages` table **per context schema**, not one shared table. A
context that later moves to its own database (D4) must take its outbox with it,
and a shared table would be exactly the cross-context coupling D4 removed.

```
outbox_messages
  id            uuid pk
  event_name    text          -- the class name, used to reconstruct
  payload       jsonb
  occurred_on   timestamptz
  dispatched_at timestamptz null
  attempts      int default 0
  last_error    text null
```

Index on `(dispatched_at, occurred_on)` — the poller's only query.

### Write path

`EventBusService.publishEvents` is no longer what a use case calls. Instead the
use case hands its events to a context-scoped `OutboxWriter` **inside the same
transaction as the aggregate save**:

```ts
await this.dataSource.transaction(async (tx) => {
  await this.repo.save(catalog, tx);
  await this.outbox.write(catalog.events, tx);
});
```

This is the only part that makes the outbox worth building: if the write and
the enqueue are not atomic, it is a slower version of what exists today.

**This changes every repository's `save`** to accept an optional transaction
manager — the largest mechanical part of this spec.

### Dispatch path

An `OutboxPoller` per context, on an interval:

1. select undispatched, oldest first, limit N, `FOR UPDATE SKIP LOCKED`
2. reconstruct the event and publish it to the existing `EventBus`
3. mark `dispatched_at` on success; increment `attempts` and record
   `last_error` on failure

`SKIP LOCKED` is what makes more than one process safe. Without it, two
instances deliver everything twice.

Reconstruction needs a registry mapping `event_name` to a class — the
integration-events directory from PR #3 is the natural home, and the mapping
should be explicit rather than derived from `constructor.name`, which a
minifier or a rename would break silently.

### Retry and failure

Exponential backoff on `attempts`; after a threshold the message stays
undispatched and stops being retried, because a message failing forever should
be visible rather than churning. §4 is how it becomes visible.

---

## 3. Idempotent consumers

At-least-once delivery is what an outbox gives. Consumers must tolerate it.

| Handler | Today | Needed |
|---|---|---|
| `CatalogDeletedHandler` → `archiveByCatalogId` | Already idempotent — a second archive sets the same status | none |
| `UserRegisteredHandler` → `UserProfile.create` + `save` | **Not** idempotent — a second delivery creates or overwrites a profile | make it so |

`UserRegisteredHandler` becomes a check-then-create against `userId`, which is
already the profile's primary key. Rejected alternative: an `inbox_messages`
table per context. It is the general answer, and it is more machinery than two
handlers justify. Revisit when a handler appears that cannot be made naturally
idempotent — that is a real possibility for payment work later.

### Verification

- Deliver the same `UserCreated` twice → one profile, unchanged.
- Deliver the same `CatalogDeleted` twice → same products archived, no error.

---

## 4. Observability

An outbox that silently stops is worse than no outbox: the writes still
succeed, so the system looks healthy while the contexts drift apart.

- `GET /health` reports, per context, the count of undispatched messages older
  than a threshold. A stuck outbox becomes a failing health check.
- The poller logs at `warn` on first failure and at `error` when a message
  passes the attempt threshold, with `correlationId` carried from the request
  that produced it — `RequestContextService` already tracks one.

This is the smallest thing that turns "delivery is durable" from a claim into
something checkable, which is the standard the audit asks of everything else.

---

## Task order

| # | Task | Verified by |
|---|------|-------------|
| 1 | `findDescendants` + cascade in `ArchiveCatalogUseCase` (§1) | Three-level unit test; two-level integration test |
| 2 | `UserRegisteredHandler` made idempotent (§3) | Double-delivery test |
| 3 | `outbox_messages` migration per context (§2) | Four tables, one per schema |
| 4 | Repository `save` accepts a transaction manager (§2) | Existing suite green |
| 5 | `OutboxWriter`, use cases write inside the transaction (§2) | Rollback test: aggregate and message roll back together |
| 6 | `OutboxPoller` with `SKIP LOCKED`, backoff (§2) | Kill-between-write-and-dispatch test |
| 7 | Health check and logging (§4) | Health fails with a stuck message |

Tasks 1 and 2 are independent of the outbox and land first: they are correct
regardless, and task 2 is a precondition for at-least-once delivery.

## Risks

| Risk | Likelihood | Handling |
|---|---|---|
| Write and enqueue are not actually atomic | **high — it is the whole point** | Task 5's acceptance is a rollback test, not a happy-path test |
| Two instances deliver everything twice | medium | `FOR UPDATE SKIP LOCKED`; the double-delivery tests cover the rest |
| `event_name` → class mapping breaks on rename | medium | Explicit registry, not `constructor.name`; a test asserts every published event type is registered |
| Threading a transaction manager through every repository churns a lot of code | **high** | It is task 4 alone, with no behaviour change, so the diff is reviewable |
| A subtree archive floods the outbox | low | Batch limit in the poller; §1 emits per catalog, which is bounded by tree size |

## Gate

`docs/gates/shared/gate-002--outbox.md`. The evidence that matters is the
kill test: process killed between the transaction commit and the dispatch,
restarted, and the event still arrives. Everything else in this spec is
plumbing around that one property.
