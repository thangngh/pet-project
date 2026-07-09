import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PRODUCT_REPOSITORY, IProductRepository } from '../../domain/ports/product.repository.port';
import { ProductDto } from '../dto/product.dto';

@Injectable()
export class GetProductUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly repo: IProductRepository) {}

  async execute(id: string): Promise<ProductDto> {
    const product = await this.repo.findById(id);
    if (!product) throw new NotFoundException('Product not found');
    return new ProductDto(product.id, product.catalogId, product.name, product.status, product.createdBy, product.description, product.attributes, product.media, product.createdAt, product.updatedAt);
  }
}
