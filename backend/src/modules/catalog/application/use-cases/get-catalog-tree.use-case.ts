import { Injectable, Inject } from '@nestjs/common';
import { CATALOG_REPOSITORY, ICatalogRepository } from '../../domain/ports/catalog.repository.port';
import { CatalogDto } from '../dto/catalog.dto';

@Injectable()
export class GetCatalogTreeUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY) private readonly repo: ICatalogRepository,
  ) {}

  async execute(): Promise<CatalogDto[]> {
    const all = await this.repo.findAll();
    const map = new Map<string, CatalogDto>();

    for (const cat of all) {
      map.set(cat.id, new CatalogDto(cat.id, cat.name, cat.status, cat.parentId, []));
    }

    const roots: CatalogDto[] = [];
    for (const dto of map.values()) {
      if (dto.parentId) {
        const parent = map.get(dto.parentId);
        if (parent) parent.children!.push(dto);
      } else {
        roots.push(dto);
      }
    }
    return roots;
  }
}
