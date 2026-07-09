import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/adapters/outbound/auth/jwt-auth.guard';
import { RolesGuard } from '../../../../auth/adapters/outbound/auth/roles.guard';
import { Roles } from '../../../../auth/adapters/outbound/auth/roles.decorator';
import { Gate } from '../../../../shared/adapters/feature-gate/gate.decorator';
import { CreateCatalogUseCase } from '../../../application/use-cases/create-catalog.use-case';
import { UpdateCatalogUseCase } from '../../../application/use-cases/update-catalog.use-case';
import { ArchiveCatalogUseCase } from '../../../application/use-cases/archive-catalog.use-case';
import { GetCatalogTreeUseCase } from '../../../application/use-cases/get-catalog-tree.use-case';
import { CreateCatalogDto } from '../../../application/dto/create-catalog.dto';
import { UpdateCatalogDto } from '../../../application/dto/update-catalog.dto';

@Controller('api/v1/catalogs')
@UseGuards(JwtAuthGuard)
export class CatalogController {
  constructor(
    private readonly createCatalog: CreateCatalogUseCase,
    private readonly updateCatalog: UpdateCatalogUseCase,
    private readonly archiveCatalog: ArchiveCatalogUseCase,
    private readonly getTree: GetCatalogTreeUseCase,
  ) {}

  @Post()
  @Gate('productCatalog')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async create(@Body() dto: CreateCatalogDto) {
    return this.createCatalog.execute(dto.name, dto.parentId);
  }

  @Patch(':id')
  @Gate('productCatalog')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async update(@Param('id') id: string, @Body() dto: UpdateCatalogDto) {
    return this.updateCatalog.execute(id, dto.name);
  }

  @Delete(':id')
  @Gate('productCatalog')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async archive(@Param('id') id: string) {
    await this.archiveCatalog.execute(id);
    return { message: 'Catalog archived' };
  }

  @Get('tree')
  @Gate('productCatalog')
  async tree() {
    return this.getTree.execute();
  }

  @Get(':id')
  @Gate('productCatalog')
  async get(@Param('id') id: string) {
    return this.getTree.execute();
  }
}
