import { Injectable, Inject } from '@nestjs/common';
import { NotFoundError } from '../../../../shared/domain/errors/domain-error';
import { PRODUCT_REPOSITORY, IProductRepository } from '../../domain/ports/product.repository.port';

@Injectable()
export class ArchiveProductUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly repo: IProductRepository) {}

  async execute(id: string): Promise<void> {
    const product = await this.repo.findById(id);
    if (!product) throw new NotFoundError('Product', id);
    product.archive();
    await this.repo.save(product);
  }
}
