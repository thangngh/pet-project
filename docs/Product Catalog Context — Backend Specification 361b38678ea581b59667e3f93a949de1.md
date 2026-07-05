# Product Catalog Context — Backend Specification

Trang con này chứa chi tiết backend specification cho Product Catalog Context.

Nội dung được tách thành sub-page để dễ bảo trì và tránh payload lớn làm Notion update timeout.

---

## 1. Purpose

Product Catalog Context quản lý catalog, product base, product attributes và product media theo từng tenant.

Context này là nguồn sự thật cho thông tin mô tả sản phẩm, trạng thái publish/archive và dữ liệu hiển thị sản phẩm.

Product Catalog không sở hữu inventory, price, voucher hoặc order. Các context khác chỉ reference `productId` như business reference.

---

## 2. Owned Data

Product Catalog Context sở hữu:

- Catalog
- Product
- ProductAttribute
- ProductMedia
- Product publication state

Product Catalog Context không sở hữu:

- ProductInventory
- ProductDiscount
- Voucher
- Cart
- Order
- Invoice

---

## 3. Functional Groups

### Catalog Management

- Create catalog
- Update catalog
- Archive catalog
- Move catalog under parent catalog
- Get catalog tree

### Product Management

- Create product
- Update product base information
- Publish product
- Archive product
- Get product detail
- Search product

### Product Attribute Management

- Add product attribute
- Update product attribute
- Remove product attribute

### Product Media Management

- Add product media
- Update product media
- Remove product media
- Set primary product image

---

## 4. Aggregate

```
Catalog (Aggregate Root)
Product (Aggregate Root)
 ├── ProductAttribute
 └── ProductMedia
```

Catalog quản lý cây phân loại sản phẩm.

Product là transaction boundary cho product base information, attributes, media và publication state.

Product không chứa inventory quantity hoặc price rule. Những dữ liệu đó thuộc bounded context khác.

---

## 5. Domain Types

```tsx
type ProductStatus = "draft" | "published" | "archived"

type MediaType = "image" | "video"

interface Catalog {
  id: string
  tenantId: string
  name: string
  parentId?: string
  status: "active" | "archived"
  createdAt: Date
  updatedAt: Date
  version: number
}

interface Product {
  id: string
  tenantId: string
  catalogId: string
  name: string
  description?: string
  status: ProductStatus
  attributes: ProductAttribute[]
  media: ProductMedia[]
  createdAt: Date
  updatedAt: Date
  version: number
}

interface ProductAttribute {
  id: string
  name: string
  value: string
}

interface ProductMedia {
  id: string
  url: string
  type: MediaType
  isPrimary: boolean
}
```

---

## 6. Use Cases

### CreateCatalog

Actor:

```
Admin / Backoffice
```

Validation:

- Catalog name is required.
- Parent catalog must exist if parentId is provided.
- Catalog name should be unique under same parent within tenant.

Published Events:

```
CatalogCreated
```

Failure Cases:

```
CATALOG_PARENT_NOT_FOUND
CATALOG_NAME_DUPLICATED
TENANT_ACCESS_DENIED
```

---

### CreateProduct

Actor:

```
Admin / Backoffice
```

Validation:

- Product name is required.
- Catalog must exist.
- Product starts with status draft.
- Tenant must match current context.

Published Events:

```
ProductCreated
```

Failure Cases:

```
CATALOG_NOT_FOUND
PRODUCT_NAME_REQUIRED
TENANT_ACCESS_DENIED
```

---

### PublishProduct

Validation:

- Product must exist.
- Product must be in draft status.
- Product must have valid catalog.
- Product should have at least one primary image if UI requires it.

Published Events:

```
ProductPublished
```

Failure Cases:

```
PRODUCT_NOT_FOUND
PRODUCT_CANNOT_PUBLISH
PRODUCT_PRIMARY_IMAGE_REQUIRED
TENANT_ACCESS_DENIED
```

---

## 7. Events

```tsx
interface CatalogCreatedPayload {
  catalogId: string
  name: string
  parentId?: string
}

interface ProductCreatedPayload {
  productId: string
  catalogId: string
  name: string
}

interface ProductPublishedPayload {
  productId: string
  catalogId: string
  name: string
  primaryImage?: string
}

interface ProductArchivedPayload {
  productId: string
  catalogId: string
}
```

---

## 8. Repository Interfaces

```tsx
interface CatalogRepository {
  save(catalog: Catalog): Promise<void>
  findById(tenantId: string, catalogId: string): Promise<Catalog | null>
  findByParentId(tenantId: string, parentId?: string): Promise<Catalog[]>
  existsByNameInParent(tenantId: string, name: string, parentId?: string): Promise<boolean>
}

interface ProductRepository {
  save(product: Product): Promise<void>
  findById(tenantId: string, productId: string): Promise<Product | null>
  findPublishedById(tenantId: string, productId: string): Promise<Product | null>
}
```

---

## 9. HTTP API

```
GET    /api/v1/catalogs
POST   /api/v1/catalogs
PATCH  /api/v1/catalogs/:catalogId
POST   /api/v1/catalogs/:catalogId/archive

GET    /api/v1/products
POST   /api/v1/products
GET    /api/v1/products/:productId
PATCH  /api/v1/products/:productId
POST   /api/v1/products/:productId/publish
POST   /api/v1/products/:productId/archive
POST   /api/v1/products/:productId/attributes
POST   /api/v1/products/:productId/media
```

---

## 10. Test Checklist

```
[ ] Create catalog succeeds with valid tenant
[ ] Duplicate catalog name under same parent fails
[ ] Create product starts with draft status
[ ] Publish product succeeds when required data is valid
[ ] Publish product without primary image fails if UI requires image
[ ] Archived product cannot be published without restore policy
[ ] ProductPublished event is written to outbox
[ ] Tenant mismatch returns TENANT_ACCESS_DENIED
```