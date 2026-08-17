# Progress Ledger — Extensible Authorization Model

- Branch: main
- Started: 2026-07-05T12:45:00Z
- Base Commit: 233c1fa
- **Closed: 2026-08-17 (spec-004 §3)**

> **This ledger ended "blocked by classifier" for work that had long since
> merged.** It was the last word on this feature for six weeks while the code
> was on `main` the whole time.

## Task Ledger

- [x] Task 1: Create role constants — `233c1fa..64d6320`
- [x] Task 2: Extend `RequestIdentity` — `64d6320..1b24ce3`
- [x] Task 3: `RolesGuard` uses the constants — `1b24ce3..1fc7bec`
- [x] Task 4: `AttributesGuard` skeleton — `1fc7bec..eaabe6b`
- [x] Task 5: `@Attributes()` decorator — `eaabe6b..b23614c`
- [x] Task 6: Wire `AttributesGuard` into `AuthModule` — `eaabe6b..ee91c31`
- [x] Task 7: Feature flags for RBAC/ABAC — merged
- [x] Task 8: Unit tests — `RolesGuard`
- [x] Task 9: Unit tests — `AttributesGuard`
- [x] Task 10: Verify spec documentation
- [x] Task 11: Final build & push — merged

**Status: complete and merged.** The "blocked by classifier" note was about the
tooling of that session, not the work.

## Corrections made since, worth knowing before reading the above

- **Task 2 created a second `RequestIdentity`.** Extending the interface meant
  extending the copy on `AUTH_MIDDLEWARE_PORT` — a port nothing implemented —
  while an identical copy sat beside `RequestContext`. They agreed by luck.
  spec-004 §1 deleted the port and left one definition.
- **Tasks 8 and 9 pass without exercising what they test.** Both stub
  `reflector.get`, so neither touches the metadata key that connects a
  decorator to its guard. `AttributesGuard` in fact declared its own copy of
  `ATTRIBUTES_KEY`; a rename on either side would have made it read metadata
  nobody writes and pass every request, with all its tests green. Fixed in
  spec-004 §1, with a test that goes through the real decorator.
- **`FEATURE_RBAC` defaulted off**, so the eleven `@Roles(ROLE_ADMIN)`
  endpoints accepted any authenticated caller until spec-002. ABAC remains off
  by design; `AttributesGuard` is a working skeleton with no route using it.
