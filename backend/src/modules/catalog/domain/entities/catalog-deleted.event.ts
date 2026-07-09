import { DomainEvent } from '../../../../shared/adapters/event-bus/domain-event';

export class CatalogDeletedEvent extends DomainEvent {
  constructor(public readonly catalogId: string) {
    super();
    (this as any).eventName = 'CatalogDeleted';
  }
}
