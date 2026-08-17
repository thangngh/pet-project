import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'crypto';
import { DomainEvent } from '../event-bus/domain-event';
import { OutboxMessage } from './outbox-message.entity';
import { RequestContextService } from '../request-context/request-context.service';

/**
 * A context's transactional outbox.
 *
 * The only thing here that matters is atomicity. If the aggregate write and
 * the enqueue are not in one transaction, this is a slower version of
 * publishing straight to the bus — the process can still die between them and
 * lose the event, which is the defect it exists to remove.
 *
 * Under D4 there is no cross-context transaction available at all, so this is
 * not a durability upgrade over some better alternative: it is the only
 * correct way for two contexts to agree on anything.
 */
@Injectable()
export class Outbox {
  private readonly logger = new Logger(Outbox.name);

  constructor(
    readonly dataSource: DataSource,
    private readonly requestContext: RequestContextService,
  ) {}

  /**
   * Runs `work` in a transaction on this context's connection.
   *
   * Callers must use the supplied EntityManager for every write inside, or the
   * writes land on a different connection and the atomicity is imaginary.
   */
  async transaction<T>(work: (tx: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(work);
  }

  /**
   * Enqueues events. Requires the transaction manager rather than accepting an
   * optional one: an outbox write outside the aggregate's transaction is the
   * bug this class exists to prevent, so it is not expressible here.
   */
  async write(events: DomainEvent[], tx: EntityManager): Promise<void> {
    if (events.length === 0) return;

    const correlationId = this.requestContext.getCorrelationId() ?? null;

    const messages = events.map((event) => {
      const message = new OutboxMessage();
      message.id = randomUUID();
      message.eventName = event.eventName;
      message.payload = this.payloadOf(event);
      message.occurredOn = event.occurredOn;
      message.dispatchedAt = null;
      message.attempts = 0;
      message.lastError = null;
      message.lastAttemptAt = null;
      message.correlationId = correlationId;
      return message;
    });

    await tx.getRepository(OutboxMessage).save(messages);

    this.logger.debug(
      `Enqueued ${messages.length} message(s): ${messages
        .map((m) => m.eventName)
        .join(', ')}`,
    );
  }

  /** Everything the event carries except the base class's own bookkeeping. */
  private payloadOf(event: DomainEvent): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(event as unknown as Record<string, unknown>).filter(
        ([key]) => key !== 'occurredOn' && key !== 'eventName',
      ),
    );
  }
}
