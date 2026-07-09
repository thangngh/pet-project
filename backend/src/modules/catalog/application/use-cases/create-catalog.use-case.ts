import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { CATALOG_REPOSITORY, ICatalogRepository } from '../../domain/ports/catalog.repository.port';
import { Catalog } from '../../domain/entities/catalog.entity';
import { CatalogDto } from '../dto/catalog.dto';

@Injectable()
export class CreateCatalogUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY) private readonly repo: ICatalogRepository,
  ) {}

  async execute(name: string, parentId?: string): Promise<CatalogDto> {
    const catalog = new Catalog(uuidv4(), name, parentId);
    await this.repo.save(catalog);
    return new CatalogDto(catalog.id, catalog.name, catalog.status, catalog.parentId);
  }
}
