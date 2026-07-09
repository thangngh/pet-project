import { ProductAttribute } from '../../domain/entities/product-attribute.entity';
import { ProductMedia } from '../../domain/entities/product-media.entity';

export class ProductDto {
  constructor(
    public id: string,
    public catalogId: string,
    public name: string,
    public status: string,
    public createdBy: string,
    public description?: string,
    public attributes: ProductAttribute[] = [],
    public media: ProductMedia[] = [],
    public createdAt?: Date,
    public updatedAt?: Date,
  ) {}
}
