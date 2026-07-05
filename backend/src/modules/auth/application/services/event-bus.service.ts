import { Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { DomainEvent } from '../../../../shared/adapters/event-bus/domain-event';

@Injectable()
export class EventBusService {
  constructor(private readonly eventBus: EventBus) {}

  async publishEvents(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      this.eventBus.publish(event);
    }
  }
}
