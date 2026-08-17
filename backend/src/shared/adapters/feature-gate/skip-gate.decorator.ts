import { SetMetadata } from '@nestjs/common';

export const SKIP_GATE_KEY = 'skipGate';

/**
 * Exempts a route from every gate, including global maintenance mode.
 *
 * Exists for liveness and readiness probes. GateGuard is registered as an
 * APP_GUARD, so API_LOCKED=true would otherwise make /health answer 503 — and
 * an orchestrator reading that as "unhealthy" restarts or removes the very
 * process that is deliberately in maintenance. Maintenance mode has to be
 * survivable to be useful.
 *
 * Use it only for probes. A business endpoint that must stay up during
 * maintenance is a decision about the gate, not an exemption from it.
 */
export const SkipGate = () => SetMetadata(SKIP_GATE_KEY, true);
