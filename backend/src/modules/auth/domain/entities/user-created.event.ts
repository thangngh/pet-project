import { DomainEvent } from '../../../../shared/adapters/event-bus/domain-event';
import { UserId } from '../value-objects/user-id.value-object';
import { Email } from '../value-objects/email.value-object';

export class UserCreatedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly email: Email,
  ) {
    super();
  }
}
