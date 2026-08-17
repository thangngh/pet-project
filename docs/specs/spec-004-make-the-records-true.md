# spec-004 — Make the records true

**Implements** D12, D14 from `docs/decision.md`
**Closes** F13, F14, F17, F18, F21 from `docs/audit/audit-2026-08-17.md`
**Depends on** spec-001 to spec-003 — this slice describes what those built, so
it goes last

## Goal

Three gate artifacts recorded "Issues Found: None" for features that had never
run. Two checkpoints recorded "0 build errors" while the build failed on a
clean install. `CLAUDE.md` describes a port that authenticates every request,
and nothing implements it.

None of that was dishonest. It is what happens when a document written as a
plan is later read as a description, and nothing forces the two apart.

This slice makes the records describe the system, and marks the difference
between built and intended everywhere it survives.

## Definition of done

- [ ] Every path, directory and component named in `CLAUDE.md` exists, or is
      explicitly marked as not built
- [ ] `AUTH_MIDDLEWARE_PORT` is gone and the real auth mechanism is documented
- [ ] `.claude/memory/MEMORY.md` exists and indexes the memory files
- [ ] The stale `.superpowers/sdd/` ledgers are retired or corrected
- [ ] Checkpoints and the roadmap agree on what each phase is
- [ ] One lockfile

---

## 1. Delete the dead auth port (D12 → F13)

`AUTH_MIDDLEWARE_PORT` and `IAuthMiddlewarePort` are declared, never
implemented, never provided, never injected. The file survives only because
`AttributesGuard` imports `RequestIdentity` from it.

### Changes

1. `RequestIdentity` moves to
   `shared/adapters/request-context/request-context.types.ts`, beside the
   context that holds it. That file **already declares `RequestIdentity`**, with
   fields identical to the port's copy — identical today by luck, since nothing
   keeps them in step. The move is therefore a deletion of the port's copy and a
   redirect of `AttributesGuard`'s import, not a new definition.
2. `auth-middleware.port.ts` is deleted.
3. `CLAUDE.md`'s auth section is rewritten to describe what runs: Passport's
   `JwtStrategy` behind a per-controller `JwtAuthGuard`, which writes identity
   into `RequestContext` (spec-001 §1).

### Why delete rather than implement

The interface promises `validateApiKey`, and `CLAUDE.md` assigns API keys to
workers, schedulers and CI. None of those exist. Building it to satisfy the
document would design an API-key mechanism with no consumer to shape it —
which is how the port came to be dead in the first place.

The per-context credential table stays, marked as a plan. When Phase 4 brings
workers, the port returns with a caller.

---

## 2. Correct `CLAUDE.md` (D14 → F17, F14)

| Claim | Reality | Action |
|---|---|---|
| `backend/modules/<context>/` | `backend/src/modules/` | Correct the paths |
| `shared/adapters/tenant/` | Does not exist | Remove; note tenancy is not built |
| `cp .env.example .env` from the root | The file is in `backend/` | Correct the command |
| Auth middleware port validates every request | Passport + `JwtAuthGuard` | Rewrite (§1) |
| Disabled features return 503 | True after spec-002 §5 | Leave; it becomes accurate |
| `ConflictError`, `ApplicationError` ×3, `InfrastructureError` ×3 | Only `DomainError`, `NotFoundError`, `ValidationError`, `UnauthorizedError` exist | Document the four; mark the rest as not built |
| Handling centre, CQRS split | No context has either | Mark as intended structure |
| One use case per feature | True everywhere except Auth | Note Auth as the exception, with why |

Also **add** what spec-001 to spec-003 introduced and `CLAUDE.md` does not
mention: the per-context data sources and schemas, the migration commands, the
integration-events contract, the outbox, and the route prefix.

### The rule this slice adopts

A statement about the system is either true today or marked as a plan. The
distinction is cheap to write and was the difference between the audit taking
an afternoon and taking ten minutes.

### Not doing

The structural drift itself — Auth's missing `use-cases/`, the absent error
families, the missing handling centre — is documented, not fixed. Refactoring
working code to match a document is worth doing when the document is the
better design; that case has not been made for any of the three, and none of
them is causing a defect.

---

## 3. Memory and ledgers (D14 → F18)

- `.claude/memory/MEMORY.md` is created, indexing every memory file with its
  description, as `CLAUDE.md`'s session pipeline requires. Eight checkpoints
  reference a pipeline whose index has never existed.
- `.superpowers/sdd/gate-progress.md` lists all nine gate tasks as pending; the
  gate system has been in use since 2026-07-06. Mark it complete, with the
  commits.
- `.superpowers/sdd/progress.md` ends "blocked by classifier" for work long
  since merged. Close it.
- Phase numbering: checkpoints call Phase 3 "Shipping", the roadmap calls it
  "Cart + Pricing". The roadmap is the source; the checkpoints are corrected,
  with a note rather than a silent edit.
- `FEATURE_SHIPPING` exists with no shipping code. Keep the flag, document it
  as reserved.
- The roadmap's Phase 2 DoD still lists "Tenant isolation tests pass" after
  tenancy left scope. Strike it, with a note.

---

## 4. One lockfile (F21)

`backend/` carries both `pnpm-lock.yaml` and `package-lock.json`, written by
different package managers at different times. `CLAUDE.md` documents pnpm.

Delete `package-lock.json`. The missing `uuid` dependency fixed in PR #1 is
exactly the class of bug that hides between two lockfiles.

---

## 5. Retire the audit into the record

When this slice completes, `docs/audit/audit-2026-08-17.md` gains a status
column: for each of the 22 findings, the commit that closed it or the reason it
stands. The audit stays a dated snapshot — it is not rewritten — and the status
lives beside it.

A checkpoint records the closing state, and follows the standard the audit set:
every figure re-run, from CI rather than a local run.

---

## Task order

| # | Task | Verified by |
|---|------|-------------|
| 1 | Delete `package-lock.json` (§4) | One lockfile; CI install unchanged |
| 2 | Move `RequestIdentity`, delete the port (§1) | Build green; no import of the deleted file |
| 3 | Rewrite `CLAUDE.md` (§2) | Every path named in it exists |
| 4 | `MEMORY.md`, ledgers, phase numbering (§3) | Index resolves to real files |
| 5 | Audit status column, closing checkpoint (§5) | Every finding has a commit or a reason |

## Risks

| Risk | Likelihood | Handling |
|---|---|---|
| `CLAUDE.md` is rewritten into a new set of aspirations | **medium — it is how this happened** | Every claim marked built or planned; §5's status column forces the check |
| Deleting the port breaks an import | low | `AttributesGuard` is the only one; the build catches it |
| Duplicate `RequestIdentity` definitions diverge during the move | medium | Reconcile to one before deleting either |

## Gate

`docs/gates/shared/gate-003--records.md`. The criterion is unusual and
deliberate: someone who has not worked on this repository follows `CLAUDE.md`
from a clean clone and gets a running system without asking a question. That
was not true on 2026-08-17, and no amount of internal review would have
revealed it — the audit only found it by trying.
