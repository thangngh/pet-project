import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PRODUCT_REPOSITORY, IProductRepository } from '../../domain/ports/product.repository.port';
import { Product } from '../../domain/entities/product.entity';
import { ProductDto } from '../dto/product.dto';

@Injectable()
export class CreateProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly repo: IProductRepository,
  ) {}

  async execute(catalogId: string, name: string, createdBy: string, description?: string): Promise<ProductDto> {
    const product = new Product(uuidv4(), catalogId, name, description, 'draft', createdBy);
    await this.repo.save(product);
    return new ProductDto(product.id, product.catalogId, product.name, product.status, product.createdBy, product.description);
  }
}
