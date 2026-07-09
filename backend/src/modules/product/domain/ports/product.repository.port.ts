import { Product } from '../entities/product.entity';

export const PRODUCT_REPOSITORY = 'PRODUCT_REPOSITORY';

export interface ProductSearchCriteria {
  q?: string;
  catalogId?: string;
  status?: string;
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface IProductRepository {
  save(product: Product): Promise<void>;
  findById(id: string): Promise<Product | null>;
  search(criteria: ProductSearchCriteria): Promise<PaginatedResult<Product>>;
  archiveByCatalogId(catalogId: string): Promise<void>;
}
