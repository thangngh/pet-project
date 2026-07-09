import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/adapters/outbound/auth/jwt-auth.guard';
import { RolesGuard } from '../../../../auth/adapters/outbound/auth/roles.guard';
import { Roles } from '../../../../auth/adapters/outbound/auth/roles.decorator';
import { Gate } from '../../../../../shared/adapters/feature-gate/gate.decorator'; // from src/
import { RequestContextService } from '../../../../../shared/adapters/request-context/request-context.service';
import { CreateProductUseCase } from '../../../application/use-cases/create-product.use-case';
import { UpdateProductUseCase } from '../../../application/use-cases/update-product.use-case';
import { PublishProductUseCase } from '../../../application/use-cases/publish-product.use-case';
import { ArchiveProductUseCase } from '../../../application/use-cases/archive-product.use-case';
import { GetProductUseCase } from '../../../application/use-cases/get-product.use-case';
import { SearchProductsUseCase } from '../../../application/use-cases/search-products.use-case';
import { AddAttributeUseCase } from '../../../application/use-cases/add-attribute.use-case';
import { RemoveAttributeUseCase } from '../../../application/use-cases/remove-attribute.use-case';
import { AddMediaUseCase } from '../../../application/use-cases/add-media.use-case';
import { RemoveMediaUseCase } from '../../../application/use-cases/remove-media.use-case';
import { CreateProductDto } from '../../../application/dto/create-product.dto';
import { UpdateProductDto } from '../../../application/dto/update-product.dto';
import { SearchProductDto } from '../../../application/dto/search-product.dto';

@Controller('api/v1/products')
@UseGuards(JwtAuthGuard)
export class ProductController {
  constructor(
    private readonly createProduct: CreateProductUseCase,
    private readonly updateProduct: UpdateProductUseCase,
    private readonly publishProduct: PublishProductUseCase,
    private readonly archiveProduct: ArchiveProductUseCase,
    private readonly getProduct: GetProductUseCase,
    private readonly searchProducts: SearchProductsUseCase,
    private readonly addAttribute: AddAttributeUseCase,
    private readonly removeAttribute: RemoveAttributeUseCase,
    private readonly addMedia: AddMediaUseCase,
    private readonly removeMedia: RemoveMediaUseCase,
    private readonly requestCtx: RequestContextService,
  ) {}

  @Post()
  @Gate('productCatalog')
  @UseGuards(RolesGuard) @Roles('admin')
  async create(@Body() dto: CreateProductDto) {
    const userId = this.requestCtx.getIdentity()?.userId;
    if (!userId) throw new Error('Unauthorized');
    return this.createProduct.execute(dto.catalogId, dto.name, userId, dto.description);
  }

  @Patch(':id')
  @Gate('productCatalog')
  @UseGuards(RolesGuard) @Roles('admin')
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.updateProduct.execute(id, dto.name, dto.description);
  }

  @Post(':id/publish')
  @Gate('productCatalog')
  @UseGuards(RolesGuard) @Roles('admin')
  async publish(@Param('id') id: string) {
    return this.publishProduct.execute(id);
  }

  @Post(':id/archive')
  @Gate('productCatalog')
  @UseGuards(RolesGuard) @Roles('admin')
  async archive(@Param('id') id: string) {
    await this.archiveProduct.execute(id);
    return { message: 'Product archived' };
  }

  @Get('search')
  @Gate('productCatalog')
  async search(@Query() query: SearchProductDto) {
    return this.searchProducts.execute(query);
  }

  @Get(':id')
  @Gate('productCatalog')
  async get(@Param('id') id: string) {
    return this.getProduct.execute(id);
  }

  @Post(':id/attributes')
  @Gate('productCatalog')
  @UseGuards(RolesGuard) @Roles('admin')
  async addAttr(@Param('id') id: string, @Body('name') name: string, @Body('value') value: string) {
    return this.addAttribute.execute(id, name, value);
  }

  @Delete(':id/attributes/:attrId')
  @Gate('productCatalog')
  @UseGuards(RolesGuard) @Roles('admin')
  async removeAttr(@Param('id') id: string, @Param('attrId') attrId: string) {
    return this.removeAttribute.execute(id, attrId);
  }

  @Post(':id/media')
  @Gate('productCatalog')
  @UseGuards(RolesGuard) @Roles('admin')
  async addMed(@Param('id') id: string, @Body('url') url: string, @Body('type') type: 'image' | 'video', @Body('isPrimary') isPrimary?: boolean) {
    return this.addMedia.execute(id, url, type, isPrimary);
  }

  @Delete(':id/media/:mediaId')
  @Gate('productCatalog')
  @UseGuards(RolesGuard) @Roles('admin')
  async removeMed(@Param('id') id: string, @Param('mediaId') mediaId: string) {
    return this.removeMedia.execute(id, mediaId);
  }
}
