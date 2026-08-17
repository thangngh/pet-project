---
name: verification-standard
description: The rule this project adopted after an audit found gates recording "Issues Found: None" for features that had never run
metadata:
  type: reference
---

The 2026-08-17 audit found three gate artifacts recording **"Issues Found:
None"** for features with no test and no database behind them, and two
checkpoints recording "0 build errors" while the build failed on a clean
install.

None of it was dishonest. It is what happens when a document written as a plan
is later read as a description.

The two rules adopted in response:

1. **A statement is either true today or marked as a plan.** `CLAUDE.md` marks
   every claim `[built]` or `[plan]`. Moving a marker is part of the commit
   that makes it real.
2. **Never record an unverified criterion as a pass.** Name the criterion and
   say why it was not verified. An unverified criterion recorded honestly costs
   nothing; recorded as a pass it removes the reason to ever check.

Worked examples of rule 2 in this repository: `docs/gates/shared/gate-001` says
`docker compose up -d` was never run; `gate-002` says the kill test was run by
hand because it cannot be made deterministic in jest.
