import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PRODUCT_REPOSITORY, IProductRepository } from '../../domain/ports/product.repository.port';

@Injectable()
export class ArchiveProductUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly repo: IProductRepository) {}

  async execute(id: string): Promise<void> {
    const product = await this.repo.findById(id);
    if (!product) throw new NotFoundException('Product not found');
    product.archive();
    await this.repo.save(product);
  }
}
