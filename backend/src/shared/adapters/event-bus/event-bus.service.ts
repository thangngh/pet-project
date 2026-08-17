import { Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { DomainEvent } from './domain-event';

@Injectable()
export class EventBusService {
  constructor(private readonly eventBus: EventBus) {}

  async publish(event: DomainEvent): Promise<void> {
    this.eventBus.publish(event);
  }

  async publishEvents(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      this.eventBus.publish(event);
    }
  }
}
