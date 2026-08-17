# Gate: make-the-records-true

## Gate Run: 003

**Date:** 2026-08-17
**Feature:** spec-004 — make the records describe the system
**Gate Type:** final-enable

## Decision Context

- **Feature:** Delete the dead auth port, correct `CLAUDE.md`, create the
  memory index, close the stale ledgers, and give the audit a status column
- **Status:** Complete; the clean-clone criterion was run, not reasoned about
- **Dependencies:** spec-001 to spec-003 — this slice describes what those built
- **Spec:** `docs/specs/spec-004-make-the-records-true.md`
- **Closes:** F13, F14, F17, F18, F21

## Criteria

- [x] Every path, directory and component named in `CLAUDE.md` exists, or is
      explicitly marked as not built
- [x] `AUTH_MIDDLEWARE_PORT` is gone and the real auth mechanism is documented
- [x] `.claude/memory/MEMORY.md` exists and indexes the memory files
- [x] The stale `.superpowers/sdd/` ledgers are retired or corrected
- [x] Checkpoints and the roadmap agree on what each phase is
- [x] One lockfile
- [x] **A clean clone runs by following the documentation, with no questions**

## Decision

**PASS.**

**Reason:** the clean-clone criterion passed on the first attempt — clone,
install, migrate, seed, start, authenticate, write. That is the criterion this
slice exists for, and the only one that could not be satisfied by editing prose.

---

## Evaluation Result

### Outcome

**Gate decision:** PASS
**Action:** the audit is closed. 21 of 22 findings have a commit; the 22nd has
a reason.

### Evidence

**The clean-clone test.** A fresh clone into a directory that had never seen
this project, following `README.md` and `CLAUDE.md` verbatim:

| Step | Result |
|---|---|
| `git clone` | — |
| `cp .env.example .env` | file found in `backend/`, as documented |
| `pnpm install` | ok — with one warning, below |
| `pnpm migration:run` | six migrations applied across four schemas |
| `pnpm seed:admin` | `Admin created: admin@example.com` |
| `pnpm start:dev` | `Application running on http://localhost:3001/api/v1` |
| `GET /health` | `{"status":"ok","outbox":{...all zero}}` |
| `POST /auth/login` as the seeded admin | token, 267 chars |
| `POST /api/v1/catalogs` with that token | `201`, catalog created |
| `POST /auth/register`, then `GET /me` immediately | **404** |
| `GET /me` twelve seconds later | profile, `status: active` |

The last two rows are not a defect — they are `CLAUDE.md`'s eventual-consistency
warning being true. Documentation that predicts a surprising behaviour before
you hit it is the difference this slice was for.

**One deviation, stated:** `DB_DATABASE` was pointed at an empty `ddd_clean`
rather than the shared `ddd_project`, because the latter already had every
schema and `migration:run` would have reported nothing pending. Simulating an
empty database is the point of the test; using a populated one would have
skipped the step most likely to fail.

**Every path in `CLAUDE.md` resolves.** Checked mechanically. The only misses
are the ones marked `[plan]` — `shared/adapters/tenant/`,
`shared/application/pipes/`, the handling centre, the CQRS split — which is the
marker working as intended.

**The memory index resolves in both directions:** nine links point at nine
files, and no file in `.claude/memory/` is missing from the index.

**Suites:** build clean, lint clean, **126 unit tests (20 suites)**, **53 e2e
(6 suites)**, all against PostgreSQL 16 with six migrations applied.

### Issues Found

**1. `pnpm install` ignores build scripts, including `bcrypt`'s.** It worked
here because `bcrypt` 6 ships a prebuilt binary for this platform. On a
platform without one, `pnpm seed:admin` would be the first command to fail, and
the error — a missing `bcrypt_lib.node` — does not name its own fix. Noted in
the README with the fix, rather than left for the next person to discover at
the sixth step.

Worth saying plainly: this was found by running the instructions, not by
reading them. It is the same lesson as the previous three slices.

**2. A second duplicate-by-luck definition, next to the one the spec named.**
spec-004 §1 predicted the risk for `RequestIdentity`. `ATTRIBUTES_KEY` had the
identical shape — declared once in the decorator and again in the guard, equal
by coincidence. A rename on either side would have made `AttributesGuard` read
metadata nobody writes, so it would have passed **every** request, silently,
with all five of its tests still green, because each one stubs `reflector.get`.

Fixed, with a test that goes through the real decorator and a real `Reflector`.
The lesson is about the tests rather than the constant: five tests that all
stub the same seam agree with each other, not with the system.

**3. `UserSession.rotate()` deleted rather than kept.** Deferred here by
gate-002. Refresh revokes the old session and creates a new one, which is what
makes token reuse detectable — a revoked session presented again is evidence
the token leaked. `rotate()` overwrites the one field that check depends on, so
it is not merely unused; it is a plausible-looking shortcut back to the weaker
design.

**4. One ledger task was corrected, not ticked.** `gate-progress.md` Task 7,
"update `GlobalExceptionFilter` for `GateException`", was never done as written
and did not need to be — spec-002 made `GateException` an `HttpException` and
taught the filter to carry extra body fields through, so `code` and `feature`
survive without the filter knowing what a gate is. Marking it `[x]` would have
been the same failure this slice is about.

### Deliberately not fixed

**F14 — Auth has no `use-cases/`, and three error families in `CLAUDE.md` do
not exist.** Documented instead: `CLAUDE.md` names Auth as the exception with
its reason, and marks `ConflictError`, the `ApplicationError` family and the
`InfrastructureError` family `[plan]`.

Refactoring working, tested code to match a document is worth doing when the
document is the better design. That case has not been made for either, and
neither is causing a defect. The rule this slice adopted cuts both ways: the
document is not automatically right.

### The rule that came out of this

> A statement about the system is either true today or marked as a plan.

`CLAUDE.md` now marks every claim `[built]` or `[plan]`, and moving a marker is
part of the commit that makes it real. The cost is a word per sentence. The
alternative cost was an audit — and three gates that recorded "Issues Found:
None" for features that had never run.

### Next Step

None. The audit → decisions → specs chain is complete: 21 findings closed, 1
documented, four gates recorded. Every figure here came from a local run; CI on
this commit is the confirmation.
