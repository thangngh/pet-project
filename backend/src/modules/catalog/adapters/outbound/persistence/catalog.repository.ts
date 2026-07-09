import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TypeOrmCatalog } from './typeorm-catalog.entity';
import { Catalog } from '../../../domain/entities/catalog.entity';
import { ICatalogRepository } from '../../../domain/ports/catalog.repository.port';

@Injectable()
export class CatalogRepository implements ICatalogRepository {
  constructor(
    @InjectRepository(TypeOrmCatalog) private readonly repo: Repository<TypeOrmCatalog>,
  ) {}

  async save(catalog: Catalog): Promise<void> {
    await this.repo.save(this.toTypeOrm(catalog));
  }

  async findById(id: string): Promise<Catalog | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findAll(): Promise<Catalog[]> {
    const entities = await this.repo.find();
    return entities.map(e => this.toDomain(e));
  }

  async findChildren(parentId: string): Promise<Catalog[]> {
    const entities = await this.repo.find({ where: { parentId } });
    return entities.map(e => this.toDomain(e));
  }

  private toTypeOrm(domain: Catalog): TypeOrmCatalog {
    const entity = new TypeOrmCatalog();
    entity.id = domain.id;
    entity.name = domain.name;
    entity.parentId = domain.parentId;
    entity.status = domain.status;
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;
    entity.version = domain.version;
    return entity;
  }

  private toDomain(entity: TypeOrmCatalog): Catalog {
    return new Catalog(
      entity.id, entity.name, entity.parentId,
      entity.status as any, entity.createdAt, entity.updatedAt, entity.version,
    );
  }
}
