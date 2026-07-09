import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PRODUCT_REPOSITORY, IProductRepository } from '../../domain/ports/product.repository.port';
import { ProductDto } from '../dto/product.dto';

@Injectable()
export class UpdateProductUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly repo: IProductRepository) {}

  async execute(id: string, name: string, description?: string): Promise<ProductDto> {
    const product = await this.repo.findById(id);
    if (!product) throw new NotFoundException('Product not found');
    product.updateDetails(name, description);
    await this.repo.save(product);
    return new ProductDto(product.id, product.catalogId, product.name, product.status, product.createdBy, product.description);
  }
}
