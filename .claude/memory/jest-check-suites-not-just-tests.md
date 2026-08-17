---
name: jest-check-suites-not-just-tests
description: A jest suite that fails to compile contributes zero tests, so a rising pass count can hide a broken file
metadata:
  type: feedback
---

`pnpm test` printed **"94 passed"** while `register.spec.ts` failed to compile.
A suite that does not compile contributes **zero** tests, so the number went up
and nothing looked wrong. My own `grep` for the `Tests:` line is what hid it.

Read the **`Suites:`** line as well:

```
Test Suites: 20 passed, 20 total     ← this one
Tests:       126 passed, 126 total
```

Same class of error as a health check that reports on the wrong thing: the
signal was present and the filter removed it.
