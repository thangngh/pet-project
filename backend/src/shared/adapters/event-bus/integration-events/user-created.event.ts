import { DomainEvent } from '../domain-event';

/**
 * Published by the Auth context when a registration succeeds.
 * Consumed by the User context to create the matching profile.
 */
export class UserCreatedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
  ) {
    super();
  }
}
