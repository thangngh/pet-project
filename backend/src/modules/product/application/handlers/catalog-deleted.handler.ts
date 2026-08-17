import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CatalogDeletedEvent } from '../../../../shared/adapters/event-bus/integration-events/catalog-deleted.event';
import { PRODUCT_REPOSITORY, IProductRepository } from '../../domain/ports/product.repository.port';

@EventsHandler(CatalogDeletedEvent)
export class CatalogDeletedHandler implements IEventHandler<CatalogDeletedEvent> {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly repo: IProductRepository,
  ) {}

  async handle(event: CatalogDeletedEvent): Promise<void> {
    await this.repo.archiveByCatalogId(event.catalogId);
  }
}
