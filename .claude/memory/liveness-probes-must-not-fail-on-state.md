---
name: liveness-probes-must-not-fail-on-state
description: /health must keep answering 200 for conditions a restart cannot fix — maintenance mode and a stuck outbox both report in the body instead
metadata:
  type: project
---

`GET /health` is the **liveness** probe. Failing it asks the orchestrator to
restart the process, so it must only fail for things a restart fixes.

Two cases here, both fixed the same way:

- **`API_LOCKED=true`** made `/health` return 503, because `GateGuard` is a
  global `APP_GUARD` that checks the lock first. An orchestrator would then
  restart the process during a deliberate maintenance window, over and over.
  Fixed with `@SkipGate()` on the route.
- **A stuck outbox** reports `{"status":"degraded", "outbox":{…}}` with HTTP
  **200**. The messages are in the database, not in memory — a restart cannot
  unstick them, so failing liveness would only flap.

spec-003 §4 asked for "a failing health check". The deviation is deliberate and
recorded in `docs/gates/shared/gate-002--outbox.md`: report the failure in the
body, where a readiness probe or an alert reads it, without asking the
orchestrator to respond by killing things.
