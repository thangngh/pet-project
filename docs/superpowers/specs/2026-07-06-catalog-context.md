# Catalog Context — Phase 2A

**Date:** 2026-07-06
**Status:** Draft
**Phase:** 2A (Product Catalog split)

## 1. Purpose

Catalog Context manages the product category tree. It is an independent BC — Product Context references `catalogId` as string, never as FK.

## 2. Owned Data

**Owns:**
- Catalog tree (parent/child hierarchy)
- Catalog status lifecycle

**Does not own:**
- Product (Product BC)
- Media (Product BC)
- Attributes (Product BC)
- Inventory, Price, Order

## 3. Architecture

```
Catalog BC (modules/catalog/)
└── Catalog (Aggregate Root)
    ├── id: string (UUID)
    ├── name: string
    ├── parentId?: string  (self-reference, NOT FK)
    ├── status: 'active' | 'archived'
    └── version: number
```

- `parentId` tự tham chiếu trong cùng aggregate — self-referencing tree
- `createdBy: string` từ `RequestContext.identity.userId` (event reference)
- `CatalogCreated` / `CatalogArchived` events publish cho hệ thống

## 4. Use Cases (Catalog)

| Use Case | Actor | Input | Output |
|----------|-------|-------|--------|
| CreateCatalog | Admin | `name`, `parentId?` | CatalogDto |
| UpdateCatalog | Admin | `id`, `name` | CatalogDto |
| ArchiveCatalog | Admin | `id` | void |
| GetCatalogTree | Public | — | Tree<CatalogDto> |
| GetCatalog | Public | `id` | CatalogDto |

## 5. API

| Method | Path | Gate | Roles |
|--------|------|------|-------|
| `POST` | `/api/v1/catalogs` | `productCatalog` | Admin |
| `PATCH` | `/api/v1/catalogs/:id` | `productCatalog` | Admin |
| `DELETE` | `/api/v1/catalogs/:id` | `productCatalog` | Admin |
| `GET` | `/api/v1/catalogs/tree` | `productCatalog` | — |
| `GET` | `/api/v1/catalogs/:id` | `productCatalog` | — |

## 6. Files

```
backend/src/modules/catalog/
├── catalog.module.ts
├── domain/
│   ├── entities/catalog.entity.ts
│   └── ports/catalog.repository.port.ts
├── application/
│   ├── dto/catalog.dto.ts
│   └── use-cases/
│       ├── create-catalog.use-case.ts
│       ├── update-catalog.use-case.ts
│       ├── archive-catalog.use-case.ts
│       └── get-catalog-tree.use-case.ts
└── adapters/
    ├── inbound/controllers/catalog.controller.ts
    └── outbound/persistence/
        ├── typeorm-catalog.entity.ts
        └── catalog.repository.ts
```

## 7. Non-Goals

- ❌ Product management (Phase 2B)
- ❌ Media management
- ❌ Attribute management
- ❌ Tenant isolation (deferred)
