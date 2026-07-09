import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { PRODUCT_REPOSITORY, IProductRepository } from '../../domain/ports/product.repository.port';

@EventsHandler()
export class CatalogDeletedHandler implements IEventHandler {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly repo: IProductRepository,
  ) {}

  async handle(event: any): Promise<void> {
    if (event.eventName === 'CatalogDeleted' && event.catalogId) {
      await this.repo.archiveByCatalogId(event.catalogId);
    }
  }
}
