# Progress Ledger — Feature Gate System Phase 1B

- Branch: main
- Started: 2026-07-06
- Base Commit: 029d804
- **Closed: 2026-08-17 (spec-004 §3)**

> **This ledger was stale.** It listed all nine tasks as pending while the gate
> system had been in use since 2026-07-06 — `@Gate()` guards eighteen endpoints
> across three controllers. Nothing updated it after task 1, and nothing failed
> when it went out of date, which is why it stayed wrong for six weeks.
>
> Reconstructed below from the commits that did the work.

## Task Ledger

- [x] Task 1: Types + GateException — `6d659fb`
- [x] Task 2: FeatureGateService — `485c8d1`
- [x] Task 3: `@Gate` decorator — `485c8d1`
- [x] Task 4: GateGuard — `485c8d1`
- [x] Task 5: Register in SharedAdaptersModule — `1b1c200`
- [x] Task 6: Update `app.config.ts` and `.env.example` — `1b1c200` (config),
      `.env.example` followed later
- [~] Task 7: Update GlobalExceptionFilter for GateException — **not done as
      written, and not needed.** There is no `GateException` branch in the
      filter. spec-002 made `GateException extend HttpException` and taught the
      filter to carry an `HttpException`'s extra body fields through, so `code`
      and `feature` survive without the filter knowing what a gate is. Closed
      by `1979409`.
- [x] Task 8: Unit tests — `feature-gate.guard.spec.ts`
- [x] Task 9: Final build & push — merged; the gate system is live

## What the ledger missed

Recording task 1 and then nothing meant the ledger never showed that the
**503 body was empty of its `code` until 2026-08-17**. A disabled feature and a
crashed dependency were indistinguishable to a client for six weeks. See
`docs/gates/auth/gate-001--enforce.md`.
