import { Injectable, Inject } from '@nestjs/common';
import { NotFoundError } from '../../../../shared/domain/errors/domain-error';
import { v4 as uuidv4 } from 'uuid';
import { PRODUCT_REPOSITORY, IProductRepository } from '../../domain/ports/product.repository.port';
import { ProductDto } from '../dto/product.dto';

@Injectable()
export class AddMediaUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly repo: IProductRepository) {}

  async execute(productId: string, url: string, type: 'image' | 'video', isPrimary?: boolean): Promise<ProductDto> {
    const product = await this.repo.findById(productId);
    if (!product) throw new NotFoundError('Product', productId);
    product.addMedia(uuidv4(), url, type, isPrimary);
    await this.repo.save(product);
    return new ProductDto(product.id, product.catalogId, product.name, product.status, product.createdBy, product.description, product.attributes, product.media, product.createdAt, product.updatedAt);
  }
}
