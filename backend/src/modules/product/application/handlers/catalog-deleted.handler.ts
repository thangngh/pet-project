import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Inject, OnModuleInit } from '@nestjs/common';
import { CatalogDeletedEvent } from '../../../../shared/adapters/event-bus/integration-events/catalog-deleted.event';
import { IntegrationEventDispatcher } from '../../../../shared/adapters/outbox/integration-event-dispatcher';
import {
  PRODUCT_REPOSITORY,
  IProductRepository,
} from '../../domain/ports/product.repository.port';

@EventsHandler(CatalogDeletedEvent)
export class CatalogDeletedHandler
  implements IEventHandler<CatalogDeletedEvent>, OnModuleInit
{
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly repo: IProductRepository,
    private readonly dispatcher: IntegrationEventDispatcher,
  ) {}

  /**
   * Registers with the dispatcher the outbox poller awaits.
   *
   * @EventsHandler stays for the in-process bus, but the outbox path cannot
   * use it: EventBus.publish returns void and runs handlers detached, so a
   * message would be marked delivered whether or not this ran.
   */
  onModuleInit(): void {
    this.dispatcher.register(CatalogDeletedEvent, this);
  }

  /**
   * Already idempotent: archiving a product that is archived sets the same
   * status. At-least-once redelivery costs an extra UPDATE and changes
   * nothing.
   */
  async handle(event: CatalogDeletedEvent): Promise<void> {
    await this.repo.archiveByCatalogId(event.catalogId);
  }
}
