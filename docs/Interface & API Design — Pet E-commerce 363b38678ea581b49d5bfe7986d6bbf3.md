# Interface & API Design — Pet E-commerce

Trang này mô tả API contract, request/response DTO, error response, pagination, auth context và interface design giữa frontend/backend cũng như giữa bounded contexts.

Mục tiêu là giúp API không bị phát triển tùy hứng như mỗi endpoint là một bộ lạc riêng.

---

## Scope

Bao gồm:

- API design principles
- REST route convention
- Request/response DTO convention
- Error response contract
- Pagination contract
- Auth/session endpoints
- Context API list
- Internal application interface convention

---

## 1. API Design Principles

API phải là contract ổn định giữa frontend, backend và các consumer khác.

Nguyên tắc:

- API response dùng DTO, không expose domain entity hoặc ORM model.
- Error response dùng format thống nhất.
- Pagination dùng format thống nhất.
- Public API không trả unbounded list.
- Route name phải phản ánh resource/action rõ ràng.
- Breaking change không được đưa vào cùng version API.
- API phải tenant-aware qua auth/request context, không nhận tenantId từ body.

Rule:

```
API is a product contract, not a dump of backend internals.

---

## 10. Cart API Contract

### Get Cart

```

GET /api/v1/cart

```

Response:

```

interface CartResponse {

cartId: string

items: CartItemResponse[]

subtotalAmount: number

productDiscountAmount: number

voucherDiscountAmount: number

finalAmount: number

appliedVoucher?: string

}

interface CartItemResponse {

itemId: string

productId: string

productName: string

primaryImage?: string

quantity: number

priceSnapshot: number

finalPrice: number

itemSubtotal: number

availabilityStatus: "available" | "out_of_stock" | "unavailable"

}

```

### Add Cart Item

```

POST /api/v1/cart/items

```

Request:

```

interface AddCartItemRequest {

productId: string

quantity: number

}

```

Errors:

```

PRODUCT_NOT_FOUND

PRODUCT_NOT_AVAILABLE

INVALID_QUANTITY

TENANT_ACCESS_DENIED

```

---

## 11. Voucher / Pricing API Contract

### Apply Voucher To Cart

```

POST /api/v1/cart/voucher

```

Request:

```

interface ApplyVoucherRequest {

voucherCode: string

}

```

Errors:

```

VOUCHER_NOT_FOUND

VOUCHER_EXPIRED

VOUCHER_USAGE_EXCEEDED

VOUCHER_MIN_ORDER_NOT_REACHED

```

---

## 12. Checkout API Contract

### Checkout Cart

```

POST /api/v1/cart/checkout

```

Request:

```

interface CheckoutCartRequest {

addressId: string

shippingMethod: string

paymentMethod: "cod" | "online"

idempotencyKey: string

}

```

Errors:

```

CART_EMPTY

INSUFFICIENT_STOCK

PRICE_CHANGED

IDEMPOTENCY_CONFLICT

```

Rule:

```

Checkout command must be idempotent by idempotencyKey.

---

## 13. Order API Contract

### Get Order Detail

```
GET /api/v1/orders/:orderId
```

Response:

```tsx
interface OrderDetailResponse {
  orderId: string
  orderCode: string
  status: "pending_payment" | "confirmed" | "paid" | "shipping" | "delivered" | "cancelled" | "refunded"
  customerId: string
  items: OrderItemResponse[]
  totalAmount: number
  discountAmount: number
  finalAmount: number
  createdAt: string
}

interface OrderItemResponse {
  productId: string
  productName: string
  quantity: number
  price: number
  discount: number
  finalPrice: number
}
```

### List My Orders

```
GET /api/v1/orders
```

Response:

```tsx
type ListOrdersResponse = PageResponse<OrderSummaryResponse>
```

Errors:

```
ORDER_NOT_FOUND
TENANT_ACCESS_DENIED
```

---

## 14. Payment / Invoice API Contract

```
GET  /api/v1/invoices/:invoiceId
GET  /api/v1/orders/:orderId/invoice
POST /api/v1/payments/initiate
POST /api/v1/refunds
```

### Initiate Payment

```tsx
interface InitiatePaymentRequest {
  orderId: string
  paymentMethod: "online"
  idempotencyKey: string
}

interface InitiatePaymentResponse {
  paymentTransactionId: string
  paymentRedirectUrl: string
  expiresAt: string
}
```

Errors:

```
INVOICE_NOT_FOUND
PAYMENT_ALREADY_CONFIRMED
PAYMENT_AMOUNT_MISMATCH
IDEMPOTENCY_CONFLICT
```

---

## 15. Shipping API Contract

```
GET    /api/v1/addresses
POST   /api/v1/addresses
PATCH  /api/v1/addresses/:addressId
DELETE /api/v1/addresses/:addressId
POST   /api/v1/addresses/:addressId/default

GET    /api/v1/shipments/:shipmentId
GET    /api/v1/orders/:orderId/shipment
```

### Address DTO

```tsx
interface AddressResponse {
  addressId: string
  receiverName: string
  phoneNumber: string
  addressLine: string
  city: string
  country: string
  isDefault: boolean
}
```

### Shipment DTO

```tsx
interface ShipmentResponse {
  shipmentId: string
  orderId: string
  status: "pending" | "created" | "in_transit" | "delivered" | "failed" | "cancelled"
  trackingCode?: string
  shippingMethod: string
  cod?: CODResponse
}

interface CODResponse {
  amount: number
  status: "pending" | "collected" | "failed" | "cancelled"
}
```

Errors:

```
SHIPMENT_NOT_FOUND
INVALID_SHIPPING_ADDRESS
INVALID_SHIPMENT_STATE
COD_AMOUNT_MISMATCH
TENANT_ACCESS_DENIED

---

## 16. Webhook Contract

Webhook endpoint dùng cho external provider như payment provider hoặc shipping provider.

Route convention:

```

POST /api/v1/webhooks/payments/:provider

POST /api/v1/webhooks/shipping/:provider

```

### Payment Webhook Request

```

interface PaymentWebhookRequest {

provider: string

providerTransactionId: string

invoiceId?: string

orderId?: string

amount: number

status: "succeeded" | "failed" | "cancelled"

occurredAt: string

rawPayload: unknown

}

```

### Shipping Webhook Request

```

interface ShippingWebhookRequest {

provider: string

trackingCode: string

shipmentId?: string

orderId?: string

status: "created" | "in_transit" | "delivered" | "failed"

reason?: string

occurredAt: string

rawPayload: unknown

}

```

Rules:

- Webhook handler must verify provider signature.
- Webhook handler must be idempotent.
- Raw payload should be stored or auditable for reconciliation if needed.
- Invalid signature returns authentication/validation error.
- Duplicate webhook must not duplicate state transition.

Errors:

```

INVALID_WEBHOOK_SIGNATURE

WEBHOOK_PROVIDER_NOT_SUPPORTED

PAYMENT_AMOUNT_MISMATCH

SHIPMENT_NOT_FOUND

IDEMPOTENCY_CONFLICT

```

---

## 17. Integration Event Contract

Cross-context events use common envelope.

```

interface IntegrationEvent<TPayload> {

eventId: string

eventName: string

eventVersion: number

occurredAt: string

tenantId: string

aggregateId: string

aggregateType: string

correlationId: string

causationId?: string

producer: string

payload: TPayload

}

```

Rules:

- Event name uses past tense.
- Event payload must not expose ORM entity.
- Event version starts from 1.
- Breaking event changes require new version.
- Consumer must be idempotent by eventId + consumerName.

Example events:

```

UserRegistered

ProductPublished

CartCheckedOut

OrderCreated

InventoryReserved

PaymentSucceeded

PaymentFailed

ShipmentCreated

ShipmentDelivered

CODCollected

```

```

```

---

API is a product contract, not a dump of backend internals.
```

---

## 2. Route Convention

Base path:

```
/api/v1
```

Resource route:

```
GET    /api/v1/products
GET    /api/v1/products/:productId
POST   /api/v1/cart/items
PATCH  /api/v1/cart/items/:itemId
DELETE /api/v1/cart/items/:itemId
```

Action route dùng khi action là business command rõ ràng:

```
POST /api/v1/products/:productId/publish
POST /api/v1/products/:productId/archive
POST /api/v1/cart/checkout
POST /api/v1/vouchers/validate
POST /api/v1/refunds
```

Admin route prefix:

```
/api/v1/admin
```

Webhook route prefix:

```
/api/v1/webhooks
```

---

## 3. Request DTO Convention

Request DTO định nghĩa dữ liệu presentation layer nhận từ client.

Quy tắc:

- Required field phải rõ.
- Optional field phải rõ.
- Validate shape ở presentation layer.
- Business invariant vẫn nằm ở application/domain layer.
- Không cho client truyền tenantId cho tenant-scoped command.

Ví dụ:

```tsx
interface AddCartItemRequest {
  productId: string
  quantity: number
}

interface ApplyVoucherRequest {
  voucherCode: string
}
```

---

## 4. Response DTO Convention

Response DTO chỉ trả dữ liệu consumer cần.

Ví dụ product card:

```tsx
interface ProductCardResponse {
  productId: string
  name: string
  primaryImage?: string
  originalPrice?: number
  finalPrice?: number
  discountBadge?: string
  stockStatus?: "available" | "low_stock" | "out_of_stock"
}
```

Ví dụ cart response:

```tsx
interface CartResponse {
  cartId: string
  items: CartItemResponse[]
  subtotalAmount: number
  productDiscountAmount: number
  voucherDiscountAmount: number
  finalAmount: number
  appliedVoucher?: string
}
```

---

## 5. Error Response Contract

Mọi API error dùng format chung:

```tsx
interface ApiErrorResponse {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
    correlationId: string
  }
}
```

Rule:

```
Frontend handles error by error.code, not message text.
```

---

## 6. Pagination Contract

List API phải dùng pagination, không trả unbounded list.

```tsx
interface PageRequest {
  page: number
  limit: number
}

interface PageResponse<T> {
  items: T[]
  page: number
  limit: number
  totalItems: number
  totalPages: number
}
```

Quy tắc:

- `page` bắt đầu từ 1.
- `limit` phải có max limit.
- Default limit nên là 20.
- Max limit MVP nên là 100.
- Search/filter phải deterministic và có sort rõ ràng.

---

## 7. Auth / User API Contract

### Register

```
POST /api/v1/auth/register
```

Request:

```tsx
interface RegisterRequest {
  firstName: string
  lastName: string
  email: string
  password: string
}
```

Response:

```tsx
interface RegisterResponse {
  userId: string
  email: string
  status: "active" | "pending"
}
```

Errors:

```
USER_EMAIL_EXISTS
INVALID_PASSWORD_POLICY
TENANT_NOT_FOUND
```

### Login

```
POST /api/v1/auth/login
```

Request:

```tsx
interface LoginRequest {
  email: string
  password: string
}
```

Response:

```tsx
interface LoginResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: CurrentUserResponse
}
```

### Current User

```
GET /api/v1/me
PATCH /api/v1/me/profile
```

Response:

```tsx
interface CurrentUserResponse {
  userId: string
  firstName: string
  lastName: string
  email: string
  phoneNumber?: string
  username?: string
  avatar?: string
  status: "active" | "blocked" | "pending"
}
```

---

## 8. Product Catalog API Contract

### List Products

```
GET /api/v1/products
```

Query:

```tsx
interface ListProductsQuery {
  page?: number
  limit?: number
  keyword?: string
  catalogId?: string
  status?: "published"
}
```

Response:

```tsx
type ListProductsResponse = PageResponse<ProductCardResponse>
```

### Product Detail

```
GET /api/v1/products/:productId
```

Response:

```tsx
interface ProductDetailResponse {
  productId: string
  catalogId: string
  name: string
  description?: string
  status: "published"
  media: ProductMediaResponse[]
  attributes: ProductAttributeResponse[]
  price?: ProductPriceResponse
  stockStatus?: "available" | "low_stock" | "out_of_stock"
}

interface ProductMediaResponse {
  mediaId: string
  url: string
  type: "image" | "video"
  isPrimary: boolean
}

interface ProductAttributeResponse {
  name: string
  value: string
}
```

### Admin Create Product

```
POST /api/v1/admin/products
```

Request:

```tsx
interface CreateProductRequest {
  catalogId: string
  name: string
  description?: string
}
```

Response:

```tsx
interface CreateProductResponse {
  productId: string
  status: "draft"
}
```

### Admin Publish Product

```
POST /api/v1/admin/products/:productId/publish
```

Errors:

```
PRODUCT_NOT_FOUND
PRODUCT_CANNOT_PUBLISH
PRODUCT_PRIMARY_IMAGE_REQUIRED
TENANT_ACCESS_DENIED
```

---

## 9. Catalog API Contract

```
GET    /api/v1/catalogs
POST   /api/v1/admin/catalogs
PATCH  /api/v1/admin/catalogs/:catalogId
POST   /api/v1/admin/catalogs/:catalogId/archive
```

Response:

```tsx
interface CatalogTreeResponse {
  catalogId: string
  name: string
  parentId?: string
  children: CatalogTreeResponse[]
}
```

---

## 8. Product Catalog API Contract

### List Products

```
GET /api/v1/products
```

Query:

```tsx
interface ListProductsQuery {
  page?: number
  limit?: number
  keyword?: string
  catalogId?: string
  status?: "published"
}
```

Response:

```tsx
type ListProductsResponse = PageResponse<ProductCardResponse>
```

### Product Detail

```
GET /api/v1/products/:productId
```

Response:

```tsx
interface ProductDetailResponse {
  productId: string
  catalogId: string
  name: string
  description?: string
  status: "published"
  media: ProductMediaResponse[]
  attributes: ProductAttributeResponse[]
  price?: ProductPriceResponse
  stockStatus?: "available" | "low_stock" | "out_of_stock"
}

interface ProductMediaResponse {
  mediaId: string
  url: string
  type: "image" | "video"
  isPrimary: boolean
}

interface ProductAttributeResponse {
  name: string
  value: string
}
```

### Admin Create Product

```
POST /api/v1/admin/products
```

Request:

```tsx
interface CreateProductRequest {
  catalogId: string
  name: string
  description?: string
}
```

Response:

```tsx
interface CreateProductResponse {
  productId: string
  status: "draft"
}
```

### Admin Publish Product

```
POST /api/v1/admin/products/:productId/publish
```

Errors:

```
PRODUCT_NOT_FOUND
PRODUCT_CANNOT_PUBLISH
PRODUCT_PRIMARY_IMAGE_REQUIRED
TENANT_ACCESS_DENIED
```

---

## 9. Catalog API Contract

```
GET    /api/v1/catalogs
POST   /api/v1/admin/catalogs
PATCH  /api/v1/admin/catalogs/:catalogId
POST   /api/v1/admin/catalogs/:catalogId/archive
```

Response:

```tsx
interface CatalogTreeResponse {
  catalogId: string
  name: string
  parentId?: string
  children: CatalogTreeResponse[]
}
```