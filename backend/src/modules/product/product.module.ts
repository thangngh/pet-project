import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmProduct } from './adapters/outbound/persistence/typeorm-product.entity';
import { ProductRepository } from './adapters/outbound/persistence/product.repository';
import { PRODUCT_REPOSITORY } from './domain/ports/product.repository.port';
import { CreateProductUseCase } from './application/use-cases/create-product.use-case';
import { UpdateProductUseCase } from './application/use-cases/update-product.use-case';
import { PublishProductUseCase } from './application/use-cases/publish-product.use-case';
import { ArchiveProductUseCase } from './application/use-cases/archive-product.use-case';
import { GetProductUseCase } from './application/use-cases/get-product.use-case';
import { SearchProductsUseCase } from './application/use-cases/search-products.use-case';
import { AddAttributeUseCase } from './application/use-cases/add-attribute.use-case';
import { RemoveAttributeUseCase } from './application/use-cases/remove-attribute.use-case';
import { AddMediaUseCase } from './application/use-cases/add-media.use-case';
import { RemoveMediaUseCase } from './application/use-cases/remove-media.use-case';
import { ProductController } from './adapters/inbound/controllers/product.controller';
import { CatalogDeletedHandler } from './application/handlers/catalog-deleted.handler';

@Module({
  imports: [TypeOrmModule.forFeature([TypeOrmProduct]), CqrsModule],
  controllers: [ProductController],
  providers: [
    { provide: PRODUCT_REPOSITORY, useClass: ProductRepository },
    CreateProductUseCase,
    UpdateProductUseCase,
    PublishProductUseCase,
    ArchiveProductUseCase,
    GetProductUseCase,
    SearchProductsUseCase,
    AddAttributeUseCase,
    RemoveAttributeUseCase,
    AddMediaUseCase,
    RemoveMediaUseCase,
    CatalogDeletedHandler,
  ],
})
export class ProductModule {}
