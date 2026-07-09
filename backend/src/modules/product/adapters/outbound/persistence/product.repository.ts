import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { TypeOrmProduct } from './typeorm-product.entity';
import { Product, ProductAttribute, ProductMedia } from '../../../domain/entities/product.entity';
import { IProductRepository, ProductSearchCriteria, PaginatedResult } from '../../../domain/ports/product.repository.port';

@Injectable()
export class ProductRepository implements IProductRepository {
  constructor(
    @InjectRepository(TypeOrmProduct) private readonly repo: Repository<TypeOrmProduct>,
  ) {}

  async save(product: Product): Promise<void> {
    await this.repo.save(this.toTypeOrm(product));
  }

  async findById(id: string): Promise<Product | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async search(criteria: ProductSearchCriteria): Promise<PaginatedResult<Product>> {
    const where: any = {};
    if (criteria.catalogId) where.catalogId = criteria.catalogId;
    if (criteria.status) where.status = criteria.status;
    if (criteria.q) where.name = Like(`%${criteria.q}%`);

    const [entities, total] = await this.repo.findAndCount({
      where,
      skip: (criteria.page - 1) * criteria.limit,
      take: criteria.limit,
      order: { createdAt: 'DESC' },
    });

    return {
      items: entities.map(e => this.toDomain(e)),
      total,
      page: criteria.page,
      limit: criteria.limit,
    };
  }

  async archiveByCatalogId(catalogId: string): Promise<void> {
    await this.repo.update({ catalogId }, { status: 'archived' });
  }

  private toTypeOrm(domain: Product): TypeOrmProduct {
    const entity = new TypeOrmProduct();
    entity.id = domain.id;
    entity.catalogId = domain.catalogId;
    entity.name = domain.name;
    entity.description = domain.description;
    entity.status = domain.status;
    entity.createdBy = domain.createdBy;
    entity.attributes = domain.attributes.map(a => ({ id: a.id, name: a.name, value: a.value }));
    entity.media = domain.media.map(m => ({ id: m.id, url: m.url, type: m.type, isPrimary: m.isPrimary }));
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;
    entity.version = domain.version;
    return entity;
  }

  private toDomain(entity: TypeOrmProduct): Product {
    const attrs = (entity.attributes || []).map(a => new ProductAttribute(a.id, a.name, a.value));
    const media = (entity.media || []).map(m => new ProductMedia(m.id, m.url, m.type as any, m.isPrimary));
    const product = new Product(
      entity.id, entity.catalogId, entity.name, entity.createdBy,
      entity.description, entity.status as any, attrs, media,
      entity.createdAt, entity.updatedAt, entity.version,
    );
    return product;
  }
}
