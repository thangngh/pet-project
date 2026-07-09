import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PRODUCT_REPOSITORY, IProductRepository } from '../../domain/ports/product.repository.port';
import { ProductDto } from '../dto/product.dto';

@Injectable()
export class RemoveMediaUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly repo: IProductRepository) {}

  async execute(productId: string, mediaId: string): Promise<ProductDto> {
    const product = await this.repo.findById(productId);
    if (!product) throw new NotFoundException('Product not found');
    product.removeMedia(mediaId);
    await this.repo.save(product);
    return new ProductDto(product.id, product.catalogId, product.name, product.status, product.createdBy, product.description, product.attributes, product.media, product.createdAt, product.updatedAt);
  }
}
