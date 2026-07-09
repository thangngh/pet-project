import { Injectable, Inject } from '@nestjs/common';
import { CATALOG_REPOSITORY, ICatalogRepository } from '../../domain/ports/catalog.repository.port';
import { CatalogDto } from '../dto/catalog.dto';

@Injectable()
export class UpdateCatalogUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY) private readonly repo: ICatalogRepository,
  ) {}

  async execute(id: string, name: string): Promise<CatalogDto> {
    const catalog = await this.repo.findById(id);
    if (!catalog) throw new Error('Catalog not found');
    catalog.updateName(name);
    await this.repo.save(catalog);
    return new CatalogDto(catalog.id, catalog.name, catalog.status, catalog.parentId);
  }
}
