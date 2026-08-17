import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OutboxMessage } from './outbox-message.entity';
import { reconstructEvent } from '../event-bus/integration-events/registry';
import { IntegrationEventDispatcher } from './integration-event-dispatcher';

export interface OutboxPollerOptions {
  context: string;
  intervalMs: number;
  batchSize: number;
  /** After this many failures a message stops being retried and stays visible. */
  maxAttempts: number;
}

export const OUTBOX_POLLER_DEFAULTS = {
  intervalMs: 1_000,
  batchSize: 50,
  maxAttempts: 10,
};

/**
 * Drains one context's outbox onto the in-process event bus.
 *
 * `FOR UPDATE SKIP LOCKED` is what makes more than one instance safe: without
 * it, two processes select the same rows and every event is delivered twice.
 * With it, each row is claimed by exactly one poller for the duration of its
 * transaction.
 *
 * Delivery is at-least-once, never exactly-once — a process can die after the
 * handler ran and before `dispatchedAt` is committed. Consumers are expected
 * to tolerate that; see UserRegisteredHandler.
 */
@Injectable()
export class OutboxPoller implements OnModuleDestroy {
  private readonly logger: Logger;
  private timer?: NodeJS.Timeout;
  private running = false;
  private stopped = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly dispatcher: IntegrationEventDispatcher,
    private readonly options: OutboxPollerOptions,
  ) {
    this.logger = new Logger(`${OutboxPoller.name}:${options.context}`);
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), this.options.intervalMs);
    // Never hold the process open on account of the poller.
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }

  /** Exposed so tests can drain deterministically instead of waiting. */
  async tick(): Promise<number> {
    // Overlapping ticks would do no harm — SKIP LOCKED handles it — but they
    // would pile up work on a slow batch for no gain.
    if (this.running || this.stopped) return 0;
    this.running = true;

    try {
      return await this.drainBatch();
    } catch (error) {
      this.logger.error(
        `Outbox poll failed: ${error instanceof Error ? error.message : error}`,
      );
      return 0;
    } finally {
      this.running = false;
    }
  }

  private async drainBatch(): Promise<number> {
    return this.dataSource.transaction(async (tx) => {
      const repo = tx.getRepository(OutboxMessage);
      const table = repo.metadata.tablePath;

      // Exponential backoff, expressed in the query so a failing message does
      // not occupy a batch slot on every tick: 1s, 2s, 4s, ... after each
      // failed attempt. A message that has never been attempted is eligible
      // immediately.
      const rows: OutboxMessage[] = await tx.query(
        `
        SELECT * FROM ${table}
        WHERE "dispatchedAt" IS NULL
          AND attempts < $1
          AND (
            "lastAttemptAt" IS NULL
            OR "lastAttemptAt" < now() - (interval '1 second' * power(2, attempts))
          )
        ORDER BY "occurredOn"
        LIMIT $2
        FOR UPDATE SKIP LOCKED
        `,
        [this.options.maxAttempts, this.options.batchSize],
      );

      let delivered = 0;

      for (const row of rows) {
        try {
          const event = reconstructEvent(
            row.eventName,
            row.payload,
            new Date(row.occurredOn),
          );

          // Awaited, so a handler failure is this message's failure. Going
          // through EventBus.publish would not do: it returns void and its
          // handlers run detached, so every message would be marked delivered
          // whether or not anything succeeded.
          await this.dispatcher.dispatch(event);

          await repo.update(row.id, { dispatchedAt: new Date() });
          delivered++;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          const attempts = row.attempts + 1;

          await repo.update(row.id, {
            attempts,
            lastError: message,
            lastAttemptAt: new Date(),
          });

          if (attempts >= this.options.maxAttempts) {
            this.logger.error(
              `Message ${row.id} (${row.eventName}) gave up after ${attempts} attempts: ${message}`,
            );
          } else {
            this.logger.warn(
              `Message ${row.id} (${row.eventName}) failed, attempt ${attempts}: ${message}`,
            );
          }
        }
      }

      return delivered;
    });
  }
}
