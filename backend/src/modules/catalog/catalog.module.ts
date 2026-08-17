import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmCatalog } from './adapters/outbound/persistence/typeorm-catalog.entity';
import { CatalogRepository } from './adapters/outbound/persistence/catalog.repository';
import { CATALOG_REPOSITORY } from './domain/ports/catalog.repository.port';
import { CreateCatalogUseCase } from './application/use-cases/create-catalog.use-case';
import { UpdateCatalogUseCase } from './application/use-cases/update-catalog.use-case';
import { ArchiveCatalogUseCase } from './application/use-cases/archive-catalog.use-case';
import { GetCatalogTreeUseCase } from './application/use-cases/get-catalog-tree.use-case';
import { GetCatalogUseCase } from './application/use-cases/get-catalog.use-case';
import { CatalogController } from './adapters/inbound/controllers/catalog.controller';
import { EventBusModule } from '../../shared/adapters/event-bus/event-bus.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TypeOrmCatalog], 'catalog'),
    EventBusModule,
  ],
  controllers: [CatalogController],
  providers: [
    { provide: CATALOG_REPOSITORY, useClass: CatalogRepository },
    CreateCatalogUseCase,
    UpdateCatalogUseCase,
    ArchiveCatalogUseCase,
    GetCatalogTreeUseCase,
    GetCatalogUseCase,
  ],
})
export class CatalogModule {}
