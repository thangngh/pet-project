import { Injectable, Inject } from '@nestjs/common';
import { NotFoundError } from '../../../../shared/domain/errors/domain-error';
import {
  PRODUCT_REPOSITORY,
  IProductRepository,
} from '../../domain/ports/product.repository.port';
import { ProductDto } from '../dto/product.dto';

@Injectable()
export class PublishProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly repo: IProductRepository,
  ) {}

  async execute(id: string): Promise<ProductDto> {
    const product = await this.repo.findById(id);
    if (!product) throw new NotFoundError('Product', id);
    product.publish();
    await this.repo.save(product);
    return new ProductDto(
      product.id,
      product.catalogId,
      product.name,
      product.status,
      product.createdBy,
      product.description,
    );
  }
}
