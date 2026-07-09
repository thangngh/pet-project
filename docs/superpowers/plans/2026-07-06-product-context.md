# Product Context — Phase 2B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Implement Product BC — product CRUD, attributes, media with search.

**Architecture:** New `modules/product/` following Hexagonal DDD. `catalogId` is string event reference. ProductAttribute + ProductMedia are child entities of Product aggregate (no separate repositories).

**Tech Stack:** NestJS 10, TypeORM 0.3, PostgreSQL, CQRS EventBus.

## Global Constraints
- `catalogId` is string event reference — NOT FK
- ProductAttribute / ProductMedia are embedded in Product aggregate
- No separate repository for attributes or media
- All endpoints gated behind `@Gate('productCatalog')`
- Admin endpoints require `@Roles('admin')`
- `userId` from RequestContext for `createdBy`

---

### Task 1: Domain — Product entity + embedded types

**Files:**
- Create: `backend/src/modules/product/domain/entities/product-attribute.entity.ts`
- Create: `backend/src/modules/product/domain/entities/product-media.entity.ts`
- Create: `backend/src/modules/product/domain/entities/product.entity.ts`
- Create: `backend/src/modules/product/domain/ports/product.repository.port.ts`

- [ ] **Step 1: ProductAttribute value object**

```ts
// product-attribute.entity.ts
export class ProductAttribute {
  constructor(
    public readonly id: string,
    public name: string,
    public value: string,
  ) {}
}
```

- [ ] **Step 2: ProductMedia value object**

```ts
// product-media.entity.ts
export class ProductMedia {
  constructor(
    public readonly id: string,
    public url: string,
    public type: 'image' | 'video',
    public isPrimary: boolean = false,
  ) {}
}
```

- [ ] **Step 3: Product aggregate**

```ts
// product.entity.ts
export class Product {
  constructor(
    public readonly id: string,
    public catalogId: string,
    public name: string,
    public description?: string,
    public status: ProductStatus = 'draft',
    public readonly createdBy: string,
    public attributes: ProductAttribute[] = [],
    public media: ProductMedia[] = [],
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
    public version: number = 1,
  ) {}

  publish(): void { this.status = 'published'; this.updatedAt = new Date(); }
  archive(): void { this.status = 'archived'; this.updatedAt = new Date(); }
  updateDetails(name: string, description?: string): void { ... }

  addAttribute(name: string, value: string): ProductAttribute { ... }
  removeAttribute(attrId: string): void { ... }

  addMedia(url: string, type: 'image'|'video', isPrimary?: boolean): ProductMedia { ... }
  removeMedia(mediaId: string): void { ... }
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/product/domain/ && git commit -m "feat: add Product domain entities"
```

---

### Task 2: Repository port

```ts
export const PRODUCT_REPOSITORY = 'PRODUCT_REPOSITORY';
export interface IProductRepository {
  save(product: Product): Promise<void>;
  findById(id: string): Promise<Product | null>;
  search(criteria: { q?: string; catalogId?: string; status?: string; page: number; limit: number }): Promise<{ items: Product[]; total: number }>;
}
```

- [ ] **Commit**

---

### Task 3: DTOs + Use Cases

**Files:**
- Create: `backend/src/modules/product/application/dto/*.dto.ts` (4 files)
- Create: `backend/src/modules/product/application/use-cases/*.ts` (11 files)

Key use cases: CreateProduct, UpdateProduct, PublishProduct, ArchiveProduct, GetProduct, SearchProducts, AddAttribute, RemoveAttribute, AddMedia, RemoveMedia.

- [ ] **Commit**: all use cases

---

### Task 4: Controller + Persistence

**Files:**
- Create: `backend/src/modules/product/adapters/inbound/controllers/product.controller.ts`
- Create: `backend/src/modules/product/adapters/outbound/persistence/typeorm-product.entity.ts`
- Create: `backend/src/modules/product/adapters/outbound/persistence/product.repository.ts`
- Create: `backend/src/modules/product/product.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Build + commit**

---

### Task 5: CatalogDeleted handler

**Files:**
- Create: `backend/src/modules/product/application/handlers/catalog-deleted.handler.ts`

- [ ] **Build + final push**
