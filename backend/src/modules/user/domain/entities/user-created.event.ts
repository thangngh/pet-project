import { DomainEvent } from '../../../../shared/adapters/event-bus/domain-event';

export class UserCreatedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
  ) {
    super();
    (this as any).eventName = 'UserCreated';
  }
}
