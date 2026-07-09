# Product Context — Phase 2B

**Date:** 2026-07-06
**Status:** Draft
**Phase:** 2B (Product Catalog split)

## 1. Purpose

Product Context manages product base information, attributes, and media. References `catalogId` and `createdBy` as string event references — no FK to Catalog BC or User BC.

## 2. Owned Data

**Owns:**
- Product aggregate (name, description, status)
- ProductAttribute (key-value)
- ProductMedia (images/videos)
- Product publication state

**Does not own:**
- Catalog tree (Catalog BC)
- Inventory, Price, Order (future BCs)

## 3. Architecture

```
Product BC (modules/product/)
└── Product (Aggregate Root)
    ├── id: string (UUID)
    ├── catalogId: string  (event ref, NOT FK)
    ├── name: string
    ├── description?: string
    ├── status: 'draft' | 'published' | 'archived'
    ├── attributes: ProductAttribute[]
    ├── media: ProductMedia[]
    ├── createdBy: string (from RequestContext)
    └── version: number
```

### Data Isolation

| Field | Type | Constraint |
|-------|------|-----------|
| `catalogId` | `string` | No FK. Catalog BC publishes `CatalogDeleted` → Product Context handles (archive products) |
| `createdBy` | `string` | No FK. Set from `RequestContext.identity.userId` |
| `ProductAttribute` | Embed | Owned by Product aggregate |
| `ProductMedia` | Embed | Owned by Product aggregate |

ProductAttribute và ProductMedia là child entities trong cùng aggregate Product, không có repository riêng — chỉ truy cập qua Product aggregate.

## 4. Events Between Catalog → Product

```
Catalog BC publishes: CatalogDeleted { catalogId }
  → Product Context handler archives all products in that catalog
```

## 5. Use Cases (Product)

| Use Case | Actor | Input | Output |
|----------|-------|-------|--------|
| CreateProduct | Admin | `catalogId`, `name`, `description?` | ProductDto |
| UpdateProduct | Admin | `id`, `name`, `description?` | ProductDto |
| PublishProduct | Admin | `id` | ProductDto |
| ArchiveProduct | Admin | `id` | ProductDto |
| GetProduct | Public | `id` | ProductDto |
| SearchProducts | Public | `q`, `catalogId?`, `status?`, `page`, `limit` | Paginated<ProductDto> |
| AddAttribute | Admin | `productId`, `name`, `value` | ProductDto |
| RemoveAttribute | Admin | `productId`, `attributeId` | ProductDto |
| AddMedia | Admin | `productId`, `url`, `type`, `isPrimary?` | ProductDto |
| RemoveMedia | Admin | `productId`, `mediaId` | ProductDto |

## 6. API

| Method | Path | Gate | Roles |
|--------|------|------|-------|
| `POST` | `/api/v1/products` | `productCatalog` | Admin |
| `PATCH` | `/api/v1/products/:id` | `productCatalog` | Admin |
| `POST` | `/api/v1/products/:id/publish` | `productCatalog` | Admin |
| `POST` | `/api/v1/products/:id/archive` | `productCatalog` | Admin |
| `GET` | `/api/v1/products/:id` | `productCatalog` | — |
| `GET` | `/api/v1/products` | `productCatalog` | — |
| `POST` | `/api/v1/products/:id/attributes` | `productCatalog` | Admin |
| `DELETE` | `/api/v1/products/:id/attributes/:attrId` | `productCatalog` | Admin |
| `POST` | `/api/v1/products/:id/media` | `productCatalog` | Admin |
| `DELETE` | `/api/v1/products/:id/media/:mediaId` | `productCatalog` | Admin |

## 7. Files

```
backend/src/modules/product/
├── product.module.ts
├── domain/
│   ├── entities/
│   │   ├── product.entity.ts
│   │   ├── product-attribute.entity.ts
│   │   └── product-media.entity.ts
│   └── ports/product.repository.port.ts
├── application/
│   ├── dto/
│   │   ├── product.dto.ts
│   │   ├── create-product.dto.ts
│   │   ├── update-product.dto.ts
│   │   └── search-product.dto.ts
│   ├── handlers/catalog-deleted.handler.ts
│   └── use-cases/  (11 files, one per use case)
└── adapters/
    ├── inbound/controllers/product.controller.ts
    └── outbound/persistence/
        ├── typeorm-product.entity.ts
        ├── typeorm-product-attribute.entity.ts
        ├── typeorm-product-media.entity.ts
        └── product.repository.ts
```

## 8. Non-Goals

- ❌ Inventory management (future BC)
- ❌ Price / Discount management (future BC)
- ❌ Cart / Order integration (future BC)
- ❌ Catalog management (Phase 2A)
- ❌ Full-text search engine (use simple DB search for MVP)
