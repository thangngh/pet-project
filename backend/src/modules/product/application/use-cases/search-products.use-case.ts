import { Injectable, Inject } from '@nestjs/common';
import { PRODUCT_REPOSITORY, IProductRepository } from '../../domain/ports/product.repository.port';
import { ProductDto } from '../dto/product.dto';
import { SearchProductDto } from '../dto/search-product.dto';

@Injectable()
export class SearchProductsUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly repo: IProductRepository) {}

  async execute(criteria: SearchProductDto): Promise<{ items: ProductDto[]; total: number }> {
    const result = await this.repo.search(criteria);
    return {
      items: result.items.map(p => new ProductDto(p.id, p.catalogId, p.name, p.status, p.createdBy, p.description, p.attributes, p.media, p.createdAt, p.updatedAt)),
      total: result.total,
    };
  }
}
