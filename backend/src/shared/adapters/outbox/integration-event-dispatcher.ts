import { Injectable, Logger } from '@nestjs/common';
import { DomainEvent } from '../event-bus/domain-event';

export interface IntegrationEventHandler<T extends DomainEvent = DomainEvent> {
  handle(event: T): Promise<void>;
}

type EventConstructor = new (...args: never[]) => DomainEvent;

/**
 * Awaits integration-event handlers, which the CQRS EventBus cannot.
 *
 * `EventBus.publish` returns `void`: it pushes onto an rxjs subject and the
 * handlers run detached, with their errors swallowed into an
 * `UnhandledExceptionBus` nothing subscribes to. Dispatching an outbox message
 * through it would mark the message delivered whether or not the handler
 * succeeded, and the retry machinery — attempts, backoff, the give-up
 * threshold — would never once fire. An outbox that cannot tell success from
 * failure is not an outbox.
 *
 * So the poller uses this instead: handlers register themselves, dispatch
 * awaits them, and a throw is the message's failure.
 *
 * Handlers self-register rather than being listed here, which keeps the
 * dependency pointing the right way — the shared kernel never imports a
 * bounded context.
 */
@Injectable()
export class IntegrationEventDispatcher {
  private readonly logger = new Logger(IntegrationEventDispatcher.name);
  private readonly handlers = new Map<string, IntegrationEventHandler[]>();

  register(event: EventConstructor, handler: IntegrationEventHandler): void {
    const key = event.name;
    const existing = this.handlers.get(key) ?? [];

    // Registration runs in onModuleInit, which Nest may call more than once
    // for a module referenced from several places.
    if (existing.includes(handler)) return;

    this.handlers.set(key, [...existing, handler]);
    this.logger.debug(`${handler.constructor.name} handles ${key}`);
  }

  /**
   * Runs every handler for this event and waits for all of them.
   *
   * Handlers run in sequence, not in parallel: a partial failure is easier to
   * reason about when the survivors are a prefix, and at these volumes there
   * is nothing to gain from overlapping them.
   */
  async dispatch(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventName) ?? [];

    if (handlers.length === 0) {
      // Loud, because it is indistinguishable from working: the message would
      // be marked delivered and nothing would have happened.
      throw new Error(
        `No handler registered for "${event.eventName}". The message would ` +
          `otherwise be marked delivered with nothing having happened.`,
      );
    }

    for (const handler of handlers) {
      await handler.handle(event);
    }
  }

  /** For assertions in tests; not used at runtime. */
  handlersFor(eventName: string): readonly IntegrationEventHandler[] {
    return this.handlers.get(eventName) ?? [];
  }
}
