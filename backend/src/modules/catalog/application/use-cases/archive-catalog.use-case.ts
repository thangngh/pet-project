import { Injectable, Inject } from '@nestjs/common';
import { NotFoundError } from '../../../../shared/domain/errors/domain-error';
import { EventBusService } from '../../../../shared/adapters/event-bus/event-bus.service';
import {
  CATALOG_REPOSITORY,
  ICatalogRepository,
} from '../../domain/ports/catalog.repository.port';

@Injectable()
export class ArchiveCatalogUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY) private readonly repo: ICatalogRepository,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(id: string): Promise<void> {
    const catalog = await this.repo.findById(id);
    if (!catalog) throw new NotFoundError('Catalog', id);
    catalog.archive();
    await this.repo.save(catalog);
    await this.eventBus.publishEvents(catalog.events);
    catalog.clearEvents();
  }
}
