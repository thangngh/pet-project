import { DomainEvent } from '../domain-event';
import { CatalogDeletedEvent } from './catalog-deleted.event';
import { UserCreatedEvent } from './user-created.event';

/**
 * Maps a stored `eventName` back to the class the event bus dispatches on.
 *
 * Explicit rather than derived from `constructor.name`. A minifier or an
 * ordinary rename would change `constructor.name` and silently orphan every
 * message already in the outbox — they would sit undispatched forever, and
 * because the writes still succeed the system would look healthy.
 *
 * @nestjs/cqrs matches handlers by class identity, so reconstruction has to
 * produce an instance of the *same* class the handler was registered against.
 * That is the defect PR #3 fixed for two same-named classes; this registry is
 * where it would come back if events were resolved by name alone.
 */
type EventConstructor = new (...args: never[]) => DomainEvent;

export const INTEGRATION_EVENTS: Record<string, EventConstructor> = {
  CatalogDeletedEvent: CatalogDeletedEvent as EventConstructor,
  UserCreatedEvent: UserCreatedEvent as EventConstructor,
};

/**
 * Rebuilds an event from its stored payload.
 *
 * Constructs via `Object.create` and assigns the payload rather than calling
 * the constructor: constructors take positional arguments, and matching them
 * up by name would be a second place that has to stay in step with each event
 * class. The class identity is what the bus dispatches on, and that is what
 * this preserves.
 */
export function reconstructEvent(
  eventName: string,
  payload: Record<string, unknown>,
  occurredOn: Date,
): DomainEvent {
  const ctor = INTEGRATION_EVENTS[eventName];

  if (!ctor) {
    throw new Error(
      `Unknown integration event "${eventName}". Add it to INTEGRATION_EVENTS ` +
        `in shared/adapters/event-bus/integration-events/registry.ts — an ` +
        `unregistered event sits in the outbox undispatched.`,
    );
  }

  const event = Object.create(ctor.prototype) as DomainEvent & {
    occurredOn: Date;
    eventName: string;
  };

  Object.assign(event, payload);
  event.occurredOn = occurredOn;
  event.eventName = eventName;

  return event;
}
