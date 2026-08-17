import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OutboxMessage } from './outbox-message.entity';
import { OUTBOX_POLLER_DEFAULTS } from './outbox-poller';

export interface ContextOutboxHealth {
  undispatched: number;
  /** Undispatched for longer than the staleness threshold. */
  stale: number;
  /** Reached the attempt limit and is no longer being retried. */
  abandoned: number;
  oldestUndispatchedAt: string | null;
}

export interface OutboxHealth {
  healthy: boolean;
  contexts: Record<string, ContextOutboxHealth>;
}

/** How long a message may sit undelivered before it counts as stuck. */
export const OUTBOX_STALE_AFTER_SECONDS = 60;

/**
 * Makes a stuck outbox an observable condition rather than a silent one.
 *
 * An outbox that quietly stops is worse than no outbox: the aggregate writes
 * still succeed, so every request looks fine while the contexts drift apart.
 * The drift is only discoverable afterwards by comparing two schemas, which is
 * exactly the position this project was in before the audit.
 */
@Injectable()
export class OutboxHealthService {
  private readonly logger = new Logger(OutboxHealthService.name);

  private readonly sources = new Map<string, DataSource>();

  register(context: string, dataSource: DataSource): void {
    this.sources.set(context, dataSource);
  }

  async check(): Promise<OutboxHealth> {
    const contexts: Record<string, ContextOutboxHealth> = {};
    let healthy = true;

    for (const [context, dataSource] of this.sources) {
      try {
        const stats = await this.statsFor(dataSource);
        contexts[context] = stats;

        // Undispatched messages are normal — the poller runs on an interval.
        // Old ones and abandoned ones are not.
        if (stats.stale > 0 || stats.abandoned > 0) healthy = false;
      } catch (error) {
        healthy = false;
        this.logger.error(
          `Outbox health check failed for ${context}: ${
            error instanceof Error ? error.message : error
          }`,
        );
        contexts[context] = {
          undispatched: -1,
          stale: -1,
          abandoned: -1,
          oldestUndispatchedAt: null,
        };
      }
    }

    return { healthy, contexts };
  }

  private async statsFor(dataSource: DataSource): Promise<ContextOutboxHealth> {
    const table = dataSource.getRepository(OutboxMessage).metadata.tablePath;

    const [row] = await dataSource.query(
      `
      SELECT
        count(*) FILTER (WHERE "dispatchedAt" IS NULL)::int AS undispatched,
        count(*) FILTER (
          WHERE "dispatchedAt" IS NULL
            AND "occurredOn" < now() - interval '${OUTBOX_STALE_AFTER_SECONDS} seconds'
        )::int AS stale,
        count(*) FILTER (
          WHERE "dispatchedAt" IS NULL AND attempts >= $1
        )::int AS abandoned,
        min("occurredOn") FILTER (WHERE "dispatchedAt" IS NULL) AS oldest
      FROM ${table}
      `,
      [OUTBOX_POLLER_DEFAULTS.maxAttempts],
    );

    return {
      undispatched: row.undispatched,
      stale: row.stale,
      abandoned: row.abandoned,
      oldestUndispatchedAt: row.oldest
        ? new Date(row.oldest).toISOString()
        : null,
    };
  }
}
