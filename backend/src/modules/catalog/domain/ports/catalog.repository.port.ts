import { Catalog } from '../entities/catalog.entity';

export const CATALOG_REPOSITORY = 'CATALOG_REPOSITORY';

export interface ICatalogRepository {
  save(catalog: Catalog): Promise<void>;
  findById(id: string): Promise<Catalog | null>;
  findAll(): Promise<Catalog[]>;
  findChildren(parentId: string): Promise<Catalog[]>;
}
