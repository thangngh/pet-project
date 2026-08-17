import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * A gated feature is unavailable, not broken.
 *
 * These used to extend plain `Error`, so GlobalExceptionFilter fell through to
 * its generic branch and answered 500 "Internal server error". Maintenance
 * mode presented as a total failure — the opposite of its purpose, and
 * indistinguishable to a client from an actual crash.
 *
 * Extending HttpException means the filter's HttpException branch carries the
 * status and body through untouched.
 */
export class GateException extends HttpException {
  constructor(
    public readonly feature: string,
    code = 'FEATURE_DISABLED',
    message = `Feature '${feature}' is currently disabled`,
  ) {
    super({ code, feature, message }, HttpStatus.SERVICE_UNAVAILABLE);
    this.name = 'GateException';
  }
}

/**
 * Global maintenance mode (API_LOCKED=true).
 *
 * Carries its own code so a client can tell "the whole API is down for
 * maintenance" from "this one feature is switched off" — they call for
 * different client behaviour, and both used to arrive as an identical 500.
 */
export class MaintenanceException extends GateException {
  constructor() {
    super('api', 'API_LOCKED', 'The API is temporarily locked for maintenance');
    this.name = 'MaintenanceException';
  }
}
