# Catalog Context — Phase 2A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** Implement Catalog BC — tree-based category management.

**Architecture:** New `modules/catalog/` following Hexagonal DDD. `catalogId` is string, no FK. Admin endpoints require `@Roles('admin')`.

**Tech Stack:** NestJS 10, TypeORM 0.3, PostgreSQL, CQRS EventBus.

## Global Constraints
- `catalogId` is string event reference — NOT FK
- Catalog BC must NOT import any other BC domain types
- All endpoints gated behind `@Gate('productCatalog')`
- `parentId` self-reference within same table — tree via adjacency list

---

### Task 1: Docker — add postgres_catalog service

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add catalog service after postgres_user**

```yaml
  postgres_catalog:
    image: postgres:16-alpine
    container_name: pet-postgres-catalog
    ports:
      - "${DB_CATALOG_PORT:-5434}:5432"
    environment:
      POSTGRES_DB: ${DB_CATALOG_DATABASE:-ddd_catalog}
      POSTGRES_USER: ${DB_CATALOG_USERNAME:-postgres}
      POSTGRES_PASSWORD: ${DB_CATALOG_PASSWORD:-postgres}
    volumes:
      - pgdata_catalog:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_CATALOG_USERNAME:-postgres} -d ${DB_CATALOG_DATABASE:-ddd_catalog}"]
      interval: 5s
      timeout: 3s
      retries: 5
```

Add `pgdata_catalog:` to volumes.

- [ ] **Step 2: Commit**

```bash
git add docker-compose.yml && git commit -m "feat: add postgres_catalog service to compose"
```

---

### Task 2: Domain — Catalog entity + port

**Files:**
- Create: `backend/src/modules/catalog/domain/entities/catalog.entity.ts`
- Create: `backend/src/modules/catalog/domain/ports/catalog.repository.port.ts`

- [ ] **Step 1: Catalog entity**

```ts
// catalog.entity.ts
export class Catalog {
  constructor(
    public readonly id: string,
    public name: string,
    public parentId?: string,
    public status: 'active' | 'archived' = 'active',
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
    public version: number = 1,
  ) {}

  updateName(name: string): void { this.name = name; this.updatedAt = new Date(); }
  archive(): void { this.status = 'archived'; this.updatedAt = new Date(); }
}
```

- [ ] **Step 2: Repository port**

```ts
// catalog.repository.port.ts
import { Catalog } from '../entities/catalog.entity';
export const CATALOG_REPOSITORY = 'CATALOG_REPOSITORY';
export interface ICatalogRepository {
  save(catalog: Catalog): Promise<void>;
  findById(id: string): Promise<Catalog | null>;
  findAll(): Promise<Catalog[]>;
  findChildren(parentId: string): Promise<Catalog[]>;
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/catalog/domain/ && git commit -m "feat: add Catalog domain entity and port"
```

---

### Task 3: Application DTOs + Use Cases

**Files:**
- Create: `backend/src/modules/catalog/application/dto/catalog.dto.ts`
- Create: `backend/src/modules/catalog/application/use-cases/create-catalog.use-case.ts`
- Create: `backend/src/modules/catalog/application/use-cases/update-catalog.use-case.ts`
- Create: `backend/src/modules/catalog/application/use-cases/archive-catalog.use-case.ts`
- Create: `backend/src/modules/catalog/application/use-cases/get-catalog-tree.use-case.ts`

- [ ] **Step 1: DTO**

```ts
// catalog.dto.ts
export class CatalogDto {
  constructor(
    public id: string, public name: string,
    public parentId?: string, public status: string,
    public children?: CatalogDto[],
  ) {}
}
```

- [ ] **Step 2: CreateCatalog use case**

```ts
// create-catalog.use-case.ts
@Injectable()
export class CreateCatalogUseCase {
  constructor(@Inject(CATALOG_REPOSITORY) private repo: ICatalogRepository) {}
  async execute(dto: { name: string; parentId?: string }): Promise<CatalogDto> {
    const catalog = new Catalog(uuidv4(), dto.name, dto.parentId);
    await this.repo.save(catalog);
    return new CatalogDto(catalog.id, catalog.name, catalog.parentId, catalog.status);
  }
}
```

- [ ] **Step 3: ArchiveCatalog use case**

```ts
// archive-catalog.use-case.ts
@Injectable()
export class ArchiveCatalogUseCase {
  constructor(@Inject(CATALOG_REPOSITORY) private repo: ICatalogRepository) {}
  async execute(id: string): Promise<void> {
    const catalog = await this.repo.findById(id);
    if (!catalog) throw new Error('Catalog not found');
    catalog.archive();
    await this.repo.save(catalog);
  }
}
```

- [ ] **Step 4: GetCatalogTree use case (build tree from flat list)**

```ts
// get-catalog-tree.use-case.ts
@Injectable()
export class GetCatalogTreeUseCase {
  constructor(@Inject(CATALOG_REPOSITORY) private repo: ICatalogRepository) {}
  async execute(): Promise<CatalogDto[]> {
    const all = await this.repo.findAll();
    const map = new Map(all.map(c => [c.id, new CatalogDto(c.id, c.name, c.parentId, c.status)]));
    const roots: CatalogDto[] = [];
    for (const dto of map.values()) {
      if (dto.parentId) map.get(dto.parentId)?.children?.push(dto);
      else roots.push(dto);
    }
    return roots;
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/catalog/application/ && git commit -m "feat: add Catalog application layer"
```

---

### Task 4: Controller + Persistence

**Files:**
- Create: `backend/src/modules/catalog/adapters/inbound/controllers/catalog.controller.ts`
- Create: `backend/src/modules/catalog/adapters/outbound/persistence/typeorm-catalog.entity.ts`
- Create: `backend/src/modules/catalog/adapters/outbound/persistence/catalog.repository.ts`
- Create: `backend/src/modules/catalog/catalog.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Controller**

```ts
// catalog.controller.ts
@Controller('api/v1/catalogs')
@UseGuards(JwtAuthGuard)
export class CatalogController {
  constructor(
    private readonly createCatalog: CreateCatalogUseCase,
    private readonly updateCatalog: UpdateCatalogUseCase,
    private readonly archiveCatalog: ArchiveCatalogUseCase,
    private readonly getTree: GetCatalogTreeUseCase,
    private readonly requestCtx: RequestContextService,
  ) {}

  @Post() @Gate('productCatalog') @Roles('admin')
  async create(@Body('name') name: string, @Body('parentId') parentId?: string) { ... }

  @Patch(':id') @Gate('productCatalog') @Roles('admin')
  async update(@Param('id') id: string, @Body('name') name: string) { ... }

  @Delete(':id') @Gate('productCatalog') @Roles('admin')
  async archive(@Param('id') id: string) { ... }

  @Get('tree') @Gate('productCatalog')
  async tree() { return this.getTree.execute(); }

  @Get(':id') @Gate('productCatalog')
  async get(@Param('id') id: string) { ... }
}
```

- [ ] **Step 2: TypeORM + Repository** (standard mapper pattern)

- [ ] **Step 3: catalog.module.ts**

```ts
@Module({
  imports: [TypeOrmModule.forFeature([TypeOrmCatalog])],
  controllers: [CatalogController],
  providers: [
    { provide: CATALOG_REPOSITORY, useClass: CatalogRepository },
    CreateCatalogUseCase, UpdateCatalogUseCase, ArchiveCatalogUseCase, GetCatalogTreeUseCase,
  ],
})
export class CatalogModule {}
```

- [ ] **Step 4: Register in app.module.ts**

```ts
import { CatalogModule } from './modules/catalog/catalog.module';
// add to imports: CatalogModule
```

- [ ] **Step 5: Build**

Run: `cd backend && pnpm build` → 0 errors

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/catalog/ backend/src/app.module.ts && git commit -m "feat: add Catalog module"
```

---

### Task 5: CatalogDeleted event + handler in Product (placeholder)

- [ ] **Step 1: Create CatalogDeletedEvent** in catalog domain
- [ ] **Step 2: Commit**

```bash
git push origin main
```
