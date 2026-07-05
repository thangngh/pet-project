# Tài liệu phát triển Pet E-commerce (DDD + EDA + SaaS)

## 1. Mục tiêu kiến trúc

Hệ thống Pet Ecommerce được thiết kế theo:

- Domain Driven Design (DDD)
- Event-Driven Architecture (EDA)
- Database per Bounded Context
- CQRS Lite
- Outbox Pattern
- Saga Pattern cho distributed transaction
- Eventually Consistent giữa các bounded context

Nguyên tắc cốt lõi:

- Không join xuyên bounded context
- Không foreign key vật lý xuyên domain
- Mỗi context sở hữu dữ liệu riêng
- Giao tiếp giữa context bằng Domain Event / Integration Event
- Snapshot dữ liệu bất biến cho Order / Invoice

---

# 2. Bounded Context

## 2.1 User Context (Simplified — SaaS Ready)

### Scope

- User Identity (authentication)
- User Profile (business info)

Không bao gồm RBAC/ABAC ở giai đoạn này.

### Aggregate

- User (Aggregate Root)
    - Identity (value object)
    - Profile (value object)

### Schema

```markdown
Table users {
id varchar [pk]
tenant_id varchar
email varchar [unique]
status varchar
created_at timestamp
}

Table user_identity {
id varchar [pk]
user_id varchar
provider varchar
password_hash varchar
provider_id varchar
}

Table user_profile {
user_id varchar [pk]
first_name varchar
last_name varchar
phone varchar
avatar varchar
}

Table outbox_event {
id varchar [pk]
aggregate_id varchar
event_type varchar
payload json
created_at timestamp
}
```

### Use Cases

- Register User
- Login
- Update Profile
- Change Password

### Domain Events

- UserCreated
- UserProfileUpdated
- UserPasswordChanged
- UserBlocked

### Repository Interface

```tsx
interface UserRepository {
save(user: User): Promise<void>

findById(userId: string): Promise<User | null>

findByEmail(email: string): Promise<User | null>

}
```

---

## 2.2 Product Catalog Context

### Aggregate

- Catalog
- Product (Aggregate Root)
- ProductAttribute
- ProductMedia

### Responsibility

- Quản lý danh mục
- Quản lý sản phẩm gốc
- Metadata sản phẩm
- SEO
- Media management

### Publish Event

- ProductCreated
- ProductUpdated
- ProductPublished
- ProductArchived

---

## 2.3 Inventory Context

### Aggregate

- ProductInventory (Aggregate Root)
- ProductInventoryAttribute

### Responsibility

- Quản lý tồn kho
- Reserve stock
- Release stock
- Inventory adjustment
- SKU management

### Publish Event

- InventoryReserved
- InventoryReleased
- InventoryAdjusted
- OutOfStockDetected

---

## 2.4 Pricing & Promotion Context

### Aggregate

- ProductDiscount
- Voucher (Aggregate Root)

### Responsibility

- Discount
- Voucher
- Flash sale
- Promotion campaign

### Publish Event

- VoucherCreated
- VoucherApplied
- DiscountStarted
- DiscountExpired

---

## 2.5 Cart Context

### Aggregate

- Cart (Aggregate Root)
- CartItem

### Responsibility

- Giỏ hàng
- Validate stock
- Validate voucher
- Calculate subtotal
- Guest cart merge

### Publish Event

- CartCreated
- ItemAddedToCart
- VoucherAppliedToCart
- CartCheckedOut

---

## 2.6 Order Context

### Aggregate

- Order (Aggregate Root)
- OrderItem

### Responsibility

- Tạo đơn hàng
- Order lifecycle
- Cancel / Return / Refund
- Fulfillment state

### Publish Event

- OrderCreated
- OrderConfirmed
- OrderCancelled
- OrderRefunded

---

## 2.7 Invoice / Payment Context

### Aggregate

- Invoice (Aggregate Root)
- PaymentTransaction
- Tax

### Responsibility

- Payment processing
- Invoice generation
- Refund
- Payment reconciliation

### Publish Event

- PaymentSucceeded
- PaymentFailed
- InvoiceGenerated
- RefundCompleted

---

## 2.8 Shipping Context

### Aggregate

- Shipment (Aggregate Root)
- COD
- CustomerAddress

### Responsibility

- Shipment creation
- Delivery tracking
- COD management
- Shipping provider integration

### Publish Event

- ShipmentCreated
- ShipmentDelivered
- CODCollected
- DeliveryFailed

---

# 3. Functional Requirements

## User Context

- Register user
- Login
- Logout
- Update profile
- Change password
- Block / activate user
- Tenant-aware authentication
- Không triển khai RBAC/ABAC ở giai đoạn MVP

## Product Catalog

- CRUD Catalog
- CRUD Product
- CRUD Product Attribute
- CRUD Product Media
- Search / Filter product

## Inventory

- CRUD inventory
- Reserve / Release stock
- Inventory audit
- Low stock alert

## Pricing

- CRUD voucher
- CRUD discount
- Validate voucher
- Apply promotion

## Cart

- Add / Update / Remove item
- Validate stock
- Apply voucher
- Calculate subtotal

## Order

- Create order
- Cancel order
- Return / Refund
- Order tracking
- Order history

## Invoice

- Generate invoice
- Confirm payment
- Refund payment
- Payment history

## Shipping

- CRUD address
- Create shipment
- Shipment tracking
- COD validation

---

# 4. Non Functional Requirements

## Performance

- Core API < 300ms
- Product search < 1s
- Checkout < 2s

## Reliability

- Idempotent payment
- Retry external integration
- Saga for distributed transaction

## Security

- JWT
- RBAC + ABAC
- Encryption sensitive data

## Scalability

- Horizontal scaling
- Async processing
- Event-driven integration

## Observability

- Audit log
- Monitoring
- Tracing
- Business metrics

## Availability

- 99.9% uptime
- Backup / Disaster recovery

---

# 5. Use Case Definition (Core)

## Create User

Input:

- email
- password
- fullName
- phone

Output:

- userId
- createdAt

## Create Product

Input:

- name
- description
- categoryId

Output:

- productId

## Reserve Inventory

Input:

- skuId
- quantity

Output:

- reserved

## Add To Cart

Input:

- userId
- skuId
- quantity

Output:

- cartId

## Apply Voucher

Input:

- cartId
- voucherCode

Output:

- discountAmount
- finalAmount

## Create Order

Input:

- userId
- cartId
- addressId
- paymentMethod

Output:

- orderId
- orderCode

## Confirm Payment

Input:

- invoiceId
- transactionId

Output:

- paid

## Create Shipment

Input:

- orderId
- addressId

Output:

- shipmentId

---

# 6. Event Driven Rules

## Không dùng FK xuyên domain

Ví dụ:

KHÔNG:

- orders.customer_id FK users.id

ĐÚNG:

- orders.customer_id chỉ là business reference

## FK nội bộ cùng aggregate được phép

Ví dụ:

- order_item.order_id -> orders.id
- cart_item.cart_id -> cart.id

## Snapshot bất biến bắt buộc

OrderItem cần lưu:

- product_id
- product_name
- product_image
- price_snapshot
- discount_snapshot
- tax_snapshot

Không phụ thuộc Product hiện tại.

---

# 7. Outbox Pattern

## Table: outbox_event

- id
- aggregate_id
- aggregate_type
- event_type
- payload
- status
- retry_count
- created_at
- processed_at

## Flow

Transaction:

Update Aggregate
+
Insert Outbox Event

↓

Background Publisher

↓

Kafka / RabbitMQ

↓

Consumer

↓

Update Read Model

---

# 8. Saga Pattern

## Checkout Flow

Cart Checkout
→ Create Order
→ Reserve Inventory
→ Create Invoice
→ Payment Success
→ Create Shipment
→ Complete Order

## Compensation Flow

Nếu Payment Failed:

- Release Inventory
- Cancel Order
- Rollback Shipment

---

# 9. CQRS Lite

## Write Model

Ví dụ:

Order Service chỉ giữ:

- Order Aggregate

## Read Model

Order Query View gồm:

- user_name
- payment_status
- shipment_status
- product_preview

Phục vụ:

- Order history
- Admin dashboard
- Customer portal

---

# 10. Aggregate Root Mapping

## Aggregate Root

### IAM

- User
- Role

### Catalog

- Product

### Inventory

- ProductInventory

### Pricing

- Voucher

### Cart

- Cart

### Order

- Order

### Invoice

- Invoice

### Shipping

- Shipment

## Transaction Boundary

Mọi consistency mạnh chỉ tồn tại trong Aggregate Root.

Cross-context dùng eventual consistency.

---

# 11. Triển khai khuyến nghị

## Tech Stack

Khuyến nghị:

- PostgreSQL
- Kafka hoặc RabbitMQ
- Outbox Pattern
- Debezium (nếu CDC)
- Redis (cache)
- Elasticsearch (search)

## Anti-pattern cần tránh

- Distributed Monolith
- Service gọi service gọi service
- Cross-service transaction sync
- FK xuyên domain
- Event publish ngoài transaction

---

# 12. Schema Refinement (Event-Driven Ready)

## Quy tắc

- Bỏ FK xuyên bounded context
- Giữ FK nội bộ aggregate
- Thêm outbox_event cho mọi DB
- Thêm inbox_event cho consumer idempotency

---

## Ví dụ Order Schema (Refined)

Table orders {
id bigint [pk]
customer_id varchar
total_amount decimal
status varchar
created_at timestamp
}

Table order_item {
id bigint [pk]
order_id bigint
product_id varchar
product_name varchar
product_image varchar
price decimal
discount decimal
final_price decimal
quantity int
}

Table outbox_event {
id varchar [pk]
aggregate_id varchar
aggregate_type varchar
event_type varchar
payload json
status varchar
created_at timestamp
}

Table inbox_event {
id varchar [pk]
event_id varchar
event_type varchar
processed_at timestamp
}

---

## Ví dụ Inventory Schema (Refined)

Table product_inventory {
id bigint [pk]
product_id varchar
quantity int
reserved_quantity int
}

---

# 13. Interface Schema (Application Layer)

## 13.1 Repository Interface

### OrderRepository

interface OrderRepository {

save(order: Order): Promise<void>

findById(orderId: string): Promise<Order | null>

}

### InventoryRepository

interface InventoryRepository {

reserve(productId: string, quantity: number): Promise<boolean>

release(productId: string, quantity: number): Promise<void>

}

---

## 13.2 Domain Service

interface PricingService {

calculatePrice(productId: string, quantity: number): Promise<number>

}

---

## 13.3 Application Service (Use Case Handler)

class CreateOrderUseCase {

constructor(

private orderRepo: OrderRepository,

private inventoryRepo: InventoryRepository,

private eventBus: EventBus

) {}

async execute(input: CreateOrderInput) {

const order = Order.create(input)

await this.orderRepo.save(order)

await this.eventBus.publish({

type: "OrderCreated",

payload: order

})

}

}

---

## 13.4 Event Bus Interface

interface EventBus {

publish(event: DomainEvent): Promise<void>

subscribe(eventType: string, handler: Function): void

}

---

## 13.5 Outbox Publisher

interface OutboxPublisher {

publishPendingEvents(): Promise<void>

}

---

## 13.6 Saga Interface

interface Saga {

handle(event: DomainEvent): Promise<void>

}

---

## 13.7 Integration Event Example

interface OrderCreatedEvent {

orderId: string

customerId: string

items: {

productId: string

quantity: number

}[]

}

---

# 14. Read Model Example

interface OrderView {

orderId: string

customerName: string

totalAmount: number

paymentStatus: string

shipmentStatus: string

}

---

# 15. Multi-Tenant Patch

## 15.1 Tenant Strategy

Giai đoạn pet-project sử dụng mô hình:

```
Single database per bounded context + tenant_id column
```

Chưa dùng database-per-tenant ở giai đoạn MVP vì complexity cao hơn giá trị nhận lại.

## 15.2 Tenant Rules

- Mọi aggregate root quan trọng phải có `tenant_id`.
- Mọi command phải lấy tenant từ `TenantContext`, không lấy từ request body.
- Mọi query phải filter theo `tenant_id`.
- Mọi integration event phải mang `tenant_id`.
- Mọi read model phải có `tenant_id`.

## 15.3 TenantContext

```tsx
interface TenantContext {
  tenantId: string
  userId: string
  requestId: string
  correlationId: string
}
```

Nguồn tạo `TenantContext`:

- JWT claim
- API Gateway
- Auth middleware
- Internal service context

---

# 16. Common Event Schema

## 16.1 IntegrationEvent

```tsx
interface IntegrationEvent<TPayload = unknown> {
  eventId: string
  eventType: string
  tenantId: string
  aggregateId: string
  aggregateType: string
  occurredAt: string
  version: number
  correlationId: string
  causationId?: string
  payload: TPayload
}
```

## 16.2 Event Rules

- Event name phải là chuyện đã xảy ra.
- Không đặt event theo kiểu command trá hình.
- Event phải đủ dữ liệu để consumer xử lý mà không cần gọi ngược service nguồn.
- Event phải có `tenantId` để tránh lẫn dữ liệu giữa tenant.

Ví dụ đúng:

```
UserCreated
OrderCreated
InventoryReserved
PaymentSucceeded
ShipmentCreated
```

Ví dụ sai:

```
CreateOrderEvent
ReserveInventoryEvent
DoPaymentEvent
```

---

# 17. Common Outbox / Inbox Schema

## 17.1 outbox_event

```
Table outbox_event {
  id varchar [pk]
  tenant_id varchar
  aggregate_id varchar
  aggregate_type varchar
  event_type varchar
  payload json
  status varchar
  retry_count int
  created_at timestamp
  processed_at timestamp
}
```

## 17.2 inbox_event

```
Table inbox_event {
  id varchar [pk]
  tenant_id varchar
  event_id varchar
  event_type varchar
  source varchar
  processed_at timestamp
}
```

## 17.3 Processing Rule

Outbox dùng để đảm bảo event được ghi cùng transaction với aggregate.

Inbox dùng để đảm bảo consumer idempotent, tránh xử lý trùng event khi retry.

---

# 18. Aggregate Invariants

## 18.1 User

- Email không được trùng trong cùng tenant.
- User bị blocked không được login.
- Password chỉ lưu dạng hash.
- User thuộc một tenant ở giai đoạn MVP.

## 18.2 Cart

- Cart chỉ được checkout khi status = `active`.
- Cart item quantity phải lớn hơn 0.
- Cart đã checkout không được thêm item.
- Cart tenant phải trùng với `TenantContext`.

## 18.3 Inventory

- `quantity >= 0`.
- `reserved_quantity >= 0`.
- `reserved_quantity <= quantity`.
- Reserve stock phải atomic.
- Release không được làm `reserved_quantity` âm.

## 18.4 Order

- Order item snapshot không được thay đổi sau khi order được tạo.
- Order đã cancelled không được confirmed.
- Order đã shipped không được update address.
- Order tenant phải trùng với cart tenant và customer tenant.

## 18.5 Invoice / Payment

- Invoice paid không được paid lại.
- Payment confirmation phải idempotent theo `provider_transaction_id`.
- Refund không được vượt quá paid amount.

## 18.6 Shipping

- Shipment delivered không được chuyển ngược về pending.
- COD collected không được collect lần hai.

---

# 19. Saga State Machine

## 19.1 Checkout Saga Flow

```
CartCheckedOut
→ OrderCreated
→ InventoryReserved
→ InvoiceGenerated
→ PaymentSucceeded / CODConfirmed
→ ShipmentCreated
→ OrderConfirmed
```

## 19.2 Compensation Flow

Nếu reserve inventory fail:

```
CancelOrder
MarkCartCheckoutFailed
```

Nếu payment fail:

```
ReleaseInventory
CancelOrder
MarkInvoiceFailed
```

Nếu shipment fail:

```
NotifyAdmin
MarkOrderNeedManualReview
```

## 19.3 Saga State

```
STARTED
ORDER_CREATED
INVENTORY_RESERVED
PAYMENT_PENDING
PAYMENT_SUCCEEDED
SHIPMENT_CREATED
COMPLETED
FAILED
COMPENSATING
COMPENSATED
```

## 19.4 checkout_saga_state

```
Table checkout_saga_state {
  id varchar [pk]
  tenant_id varchar
  correlation_id varchar
  order_id varchar
  cart_id varchar
  status varchar
  current_step varchar
  retry_count int
  last_error varchar
  created_at timestamp
  updated_at timestamp
}
```

---

# 20. Backend Development Contract

## 20.1 Mục tiêu

Mỗi bounded context phải được mô tả theo cùng một cấu trúc để BE có thể triển khai nhất quán.

Không chỉ ghi “CRUD” rồi để dev tự đoán. Đó là cách các team triệu hồi bug từ hư vô.

Một bounded context nên có cấu trúc:

```
Bounded Context
→ Functional Group
→ Use Case
→ Presentation Contract
→ Type / Interface
→ Validation Rule
→ Domain Exception
→ Domain Event / Integration Event
→ Repository / Gateway Interface
```

---

## 20.2 Bounded Context Documentation Template

Mỗi context nên được viết theo format sau:

```
Context Name:
Purpose:
Owned Data:
External References:
Functional Groups:
Use Cases:
Presentation Contracts:
Application Interfaces:
Domain Types:
Validation Rules:
Domain Exceptions:
Published Events:
Consumed Events:
Repository Interfaces:
Gateway Interfaces:
Read Models:
```

---

## 20.3 Functional Group Template

Functional group là nhóm hành vi nghiệp vụ trong một bounded context.

Ví dụ trong User Context:

```
Functional Group: Authentication
- Register user
- Login
- Logout
- Refresh token
- Change password
```

Ví dụ trong Cart Context:

```
Functional Group: Cart Management
- Create cart
- Add item
- Update quantity
- Remove item
- Apply voucher
- Checkout cart
```

---

## 20.4 Use Case Template

Mỗi use case phải định nghĩa rõ:

```
Use Case Name:
Actor:
Input:
Output:
Required Fields:
Optional Fields:
Preconditions:
Validation Rules:
Transaction Boundary:
Domain Events:
Failure Cases:
Idempotency Key:
```

Ví dụ:

```
Use Case: CheckoutCart
Actor: Customer

Input:
- cartId: required
- addressId: required
- paymentMethod: required

Context:
- tenantId: required
- userId: required
- correlationId: required

Preconditions:
- Cart exists
- Cart belongs to current tenant
- Cart belongs to current user
- Cart status is active
- Cart has at least one item

Validation Rules:
- Address must belong to customer
- Voucher must still be valid
- Product snapshots must exist
- Payment method must be supported

Transaction Boundary:
- Mark cart as checked_out
- Store CartCheckedOut event into outbox

Published Events:
- CartCheckedOut

Failure Cases:
- CART_NOT_FOUND
- CART_EMPTY
- CART_ALREADY_CHECKED_OUT
- INVALID_ADDRESS
- INVALID_PAYMENT_METHOD
- TENANT_ACCESS_DENIED

Idempotency Key:
- checkoutRequestId
```

---

## 20.5 Presentation Contract Template

Presentation contract mô tả request / response ở API layer.

Ví dụ:

```tsx
interface CheckoutCartRequest {
  cartId: string
  addressId: string
  paymentMethod: "cod" | "online"
  checkoutRequestId: string
}

interface CheckoutCartResponse {
  orderId: string
  orderCode: string
  status: "pending" | "confirmed"
}
```

Quy tắc:

- Request không chứa `tenantId` nếu tenant đã lấy từ auth context.
- Request không chứa `userId` nếu user đã lấy từ auth context.
- Response chỉ trả dữ liệu cần cho client.
- Không expose internal domain model trực tiếp ra API response.

---

## 20.6 Required / Optional Field Rule

Mỗi input type phải phân biệt rõ required và optional.

Ví dụ:

```tsx
interface RegisterUserRequest {
  email: string              // required
  password: string           // required
  firstName: string          // required
  lastName: string           // required
  phone?: string             // optional
  avatar?: string            // optional
}
```

Quy tắc:

- Required field dùng cho dữ liệu bắt buộc để thực hiện use case.
- Optional field chỉ dùng khi nghiệp vụ cho phép thiếu.
- Không dùng optional bừa bãi để né validation.
- Không nhận field mà BE không dùng.

---

## 20.7 Application Interface Template

Application interface là contract của use case handler.

```tsx
interface UseCase<TInput, TOutput> {
  execute(context: TenantContext, input: TInput): Promise<TOutput>
}
```

Ví dụ:

```tsx
class CheckoutCartUseCase implements UseCase<CheckoutCartInput, CheckoutCartOutput> {
  async execute(context: TenantContext, input: CheckoutCartInput): Promise<CheckoutCartOutput> {
    // validate tenant, cart ownership, cart status
    // update aggregate
    // save aggregate
    // save outbox event
    // return output
  }
}
```

---

## 20.8 Domain Exception Template

Domain exception phải có code cố định để presentation layer map ra HTTP response.

```tsx
abstract class DomainException extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
  }
}
```

Ví dụ:

```tsx
class CartAlreadyCheckedOutException extends DomainException {
  constructor(cartId: string) {
    super(
      "CART_ALREADY_CHECKED_OUT",
      "Cart already checked out",
      { cartId }
    )
  }
}
```

---

## 20.9 Error Code Catalog

Các error code nên được chuẩn hóa theo context.

### User

```
USER_EMAIL_EXISTS
USER_NOT_FOUND
INVALID_CREDENTIALS
USER_BLOCKED
```

### Catalog

```
CATALOG_NOT_FOUND
PRODUCT_NOT_FOUND
PRODUCT_NOT_PUBLISHED
PRODUCT_ALREADY_ARCHIVED
```

### Inventory

```
INVENTORY_NOT_FOUND
INSUFFICIENT_STOCK
INVENTORY_ALREADY_RESERVED
INVALID_STOCK_QUANTITY
```

### Cart

```
CART_NOT_FOUND
CART_EMPTY
CART_ALREADY_CHECKED_OUT
CART_ITEM_NOT_FOUND
```

### Pricing

```
VOUCHER_NOT_FOUND
VOUCHER_INVALID
VOUCHER_EXPIRED
VOUCHER_USAGE_EXCEEDED
```

### Order

```
ORDER_NOT_FOUND
ORDER_ALREADY_CANCELLED
ORDER_CANNOT_CANCEL
ORDER_CANNOT_CONFIRM
```

### Payment

```
INVOICE_NOT_FOUND
PAYMENT_ALREADY_CONFIRMED
PAYMENT_FAILED
REFUND_AMOUNT_EXCEEDED
```

### Shipping

```
SHIPMENT_NOT_FOUND
SHIPMENT_ALREADY_DELIVERED
COD_ALREADY_COLLECTED
```

### Common

```
TENANT_ACCESS_DENIED
IDEMPOTENCY_CONFLICT
VALIDATION_FAILED
RESOURCE_NOT_FOUND
```

---

## 20.10 HTTP Error Mapping

Presentation layer map domain exception sang HTTP response.

```
VALIDATION_FAILED -> 400
INVALID_CREDENTIALS -> 401
TENANT_ACCESS_DENIED -> 403
RESOURCE_NOT_FOUND -> 404
IDEMPOTENCY_CONFLICT -> 409
DOMAIN_STATE_CONFLICT -> 409
INTERNAL_ERROR -> 500
```

Ví dụ response:

```json
{
  "error": {
    "code": "CART_ALREADY_CHECKED_OUT",
    "message": "Cart already checked out",
    "details": {
      "cartId": "cart_123"
    }
  }
}
```

---

## 20.11 Backend Implementation Checklist

Khi thêm một use case mới, phải có đủ:

```
[ ] Input type
[ ] Output type
[ ] Required / optional fields
[ ] Application use case handler
[ ] Domain method trên aggregate nếu cần
[ ] Repository interface method nếu cần
[ ] Validation rules
[ ] Domain exceptions
[ ] Published events
[ ] Outbox write
[ ] Idempotency rule nếu là command quan trọng
[ ] Presentation request / response
[ ] HTTP error mapping
[ ] Unit test cho domain rule
[ ] Integration test cho repository / use case
```

---

# 21. Cart Context — Backend Specification

## 21.1 Purpose

Cart Context quản lý toàn bộ hành vi liên quan tới giỏ hàng của customer trong một tenant.

Cart là nơi user chọn sản phẩm, thay đổi số lượng, áp voucher và bắt đầu checkout.

Cart Context không sở hữu Product, Pricing, Inventory hoặc User. Các ID như `productId`, `customerId`, `voucherCode` chỉ là business reference.

---

## 21.2 Owned Data

Cart Context sở hữu:

```
Cart
CartItem
Cart voucher state
Cart price snapshot
```

Cart Context không sở hữu:

```
Product
Inventory
Voucher
User
Order
Payment
Shipment
```

---

## 21.3 Functional Groups

### Cart Management

- Create cart
- Get active cart
- Add item to cart
- Update item quantity
- Remove item from cart
- Clear cart

### Cart Pricing

- Apply voucher
- Remove voucher
- Recalculate cart total
- Store product price snapshot

### Cart Checkout

- Validate cart before checkout
- Mark cart as checked out
- Publish CartCheckedOut event

---

## 21.4 Aggregate

```
Cart (Aggregate Root)
 └── CartItem
```

Cart là transaction boundary.

Mọi thay đổi trong cart phải đi qua Cart aggregate, không update trực tiếp `cart_item` từ application service.

---

## 21.5 Domain Types

```tsx
type CartStatus = "active" | "checked_out" | "abandoned"

type PaymentMethod = "cod" | "online"

interface Cart {
  id: string
  tenantId: string
  customerId: string
  status: CartStatus
  items: CartItem[]
  voucherCode?: string
  subtotalAmount: number
  discountAmount: number
  finalAmount: number
  createdAt: Date
  updatedAt: Date
  version: number
}

interface CartItem {
  id: string
  productId: string
  productName: string
  productImage?: string
  quantity: number
  priceSnapshot: number
  discountSnapshot: number
  finalPriceSnapshot: number
}
```

---

## 21.6 Presentation Contracts

### AddToCartRequest

```tsx
interface AddToCartRequest {
  productId: string        // required
  quantity: number         // required
}

interface AddToCartResponse {
  cartId: string
  itemCount: number
  finalAmount: number
}
```

### UpdateCartItemQuantityRequest

```tsx
interface UpdateCartItemQuantityRequest {
  itemId: string           // required
  quantity: number         // required
}

interface UpdateCartItemQuantityResponse {
  cartId: string
  itemId: string
  quantity: number
  finalAmount: number
}
```

### ApplyVoucherRequest

```tsx
interface ApplyVoucherRequest {
  cartId: string           // required
  voucherCode: string      // required
}

interface ApplyVoucherResponse {
  cartId: string
  voucherCode: string
  discountAmount: number
  finalAmount: number
}
```

### CheckoutCartRequest

```tsx
interface CheckoutCartRequest {
  cartId: string             // required
  addressId: string          // required
  paymentMethod: PaymentMethod // required
  checkoutRequestId: string  // required, idempotency key
}

interface CheckoutCartResponse {
  cartId: string
  checkoutStatus: "accepted"
  correlationId: string
}
```

Request không chứa `tenantId` hoặc `userId`. Hai field đó lấy từ `TenantContext`.

---

## 21.7 Application Interfaces

```tsx
interface CartRepository {
  save(cart: Cart): Promise<void>
  findById(tenantId: string, cartId: string): Promise<Cart | null>
  findActiveByCustomerId(tenantId: string, customerId: string): Promise<Cart | null>
}

interface ProductSnapshotProvider {
  getProductSnapshot(input: {
    tenantId: string
    productId: string
  }): Promise<ProductSnapshot>
}

interface ProductSnapshot {
  productId: string
  name: string
  image?: string
  price: number
  isPurchasable: boolean
}

interface VoucherValidationGateway {
  validate(input: {
    tenantId: string
    customerId: string
    cartId: string
    voucherCode: string
    subtotalAmount: number
  }): Promise<VoucherValidationResult>
}

interface VoucherValidationResult {
  valid: boolean
  discountAmount: number
  reason?: string
}
```

---

## 21.8 Use Cases

### Use Case: AddItemToCart

Actor:

```
Customer
```

Input:

```
productId: required
quantity: required
```

Context:

```
tenantId: required
userId: required
correlationId: required
```

Preconditions:

- Product must exist.
- Product must be purchasable.
- Quantity must be greater than 0.
- Cart must be active.

Transaction Boundary:

- Load active cart or create new cart.
- Add item or increase quantity.
- Store product snapshot.
- Save cart.
- Store ItemAddedToCart event into outbox.

Published Events:

```
ItemAddedToCart
```

Failure Cases:

```
PRODUCT_NOT_FOUND
PRODUCT_NOT_PURCHASABLE
INVALID_CART_ITEM_QUANTITY
CART_ALREADY_CHECKED_OUT
TENANT_ACCESS_DENIED
```

---

### Use Case: UpdateCartItemQuantity

Input:

```
itemId: required
quantity: required
```

Validation:

- Quantity must be greater than 0.
- Cart must be active.
- Cart must belong to current tenant.
- Cart must belong to current user.

Published Events:

```
CartItemQuantityChanged
```

Failure Cases:

```
CART_NOT_FOUND
CART_ITEM_NOT_FOUND
INVALID_CART_ITEM_QUANTITY
CART_ALREADY_CHECKED_OUT
TENANT_ACCESS_DENIED
```

---

### Use Case: RemoveCartItem

Input:

```
itemId: required
```

Validation:

- Cart must be active.
- Item must exist in cart.

Published Events:

```
CartItemRemoved
```

Failure Cases:

```
CART_NOT_FOUND
CART_ITEM_NOT_FOUND
CART_ALREADY_CHECKED_OUT
```

---

### Use Case: ApplyVoucherToCart

Input:

```
cartId: required
voucherCode: required
```

Validation:

- Cart must be active.
- Cart must not be empty.
- Voucher must be valid.
- Voucher must belong to same tenant.
- Voucher must not exceed usage rule.

Transaction Boundary:

- Validate voucher through Pricing Context gateway.
- Store voucher code.
- Update discount amount.
- Save cart.
- Store VoucherAppliedToCart event into outbox.

Published Events:

```
VoucherAppliedToCart
```

Failure Cases:

```
CART_NOT_FOUND
CART_EMPTY
CART_ALREADY_CHECKED_OUT
VOUCHER_INVALID
VOUCHER_EXPIRED
VOUCHER_USAGE_EXCEEDED
TENANT_ACCESS_DENIED
```

---

### Use Case: CheckoutCart

Input:

```
cartId: required
addressId: required
paymentMethod: required
checkoutRequestId: required
```

Validation:

- Cart must exist.
- Cart must belong to current tenant.
- Cart must belong to current user.
- Cart status must be active.
- Cart must have at least one item.
- Payment method must be supported.
- Address reference must be provided.

Transaction Boundary:

- Check idempotency by `checkoutRequestId`.
- Mark cart as checked_out.
- Save cart.
- Store CartCheckedOut event into outbox.

Published Events:

```
CartCheckedOut
```

Failure Cases:

```
CART_NOT_FOUND
CART_EMPTY
CART_ALREADY_CHECKED_OUT
INVALID_PAYMENT_METHOD
INVALID_ADDRESS
IDEMPOTENCY_CONFLICT
TENANT_ACCESS_DENIED
```

---

## 21.9 Domain Behavior

```tsx
class CartAggregate {
  addItem(snapshot: ProductSnapshot, quantity: number): void {
    if (this.status !== "active") throw new CartAlreadyCheckedOutException(this.id)
    if (quantity <= 0) throw new InvalidCartItemQuantityException(quantity)
    if (!snapshot.isPurchasable) throw new ProductNotPurchasableException(snapshot.productId)

    // add item or increase quantity
    // recalculate totals
    // raise ItemAddedToCart
  }

  updateQuantity(itemId: string, quantity: number): void {
    if (this.status !== "active") throw new CartAlreadyCheckedOutException(this.id)
    if (quantity <= 0) throw new InvalidCartItemQuantityException(quantity)

    // update quantity
    // recalculate totals
    // raise CartItemQuantityChanged
  }

  applyVoucher(voucherCode: string, discountAmount: number): void {
    if (this.status !== "active") throw new CartAlreadyCheckedOutException(this.id)
    if (this.items.length === 0) throw new CartEmptyException(this.id)

    // apply voucher
    // recalculate final amount
    // raise VoucherAppliedToCart
  }

  checkout(input: { addressId: string; paymentMethod: PaymentMethod; checkoutRequestId: string }): void {
    if (this.status !== "active") throw new CartAlreadyCheckedOutException(this.id)
    if (this.items.length === 0) throw new CartEmptyException(this.id)

    this.status = "checked_out"
    // raise CartCheckedOut
  }
}
```

---

## 21.10 Domain Exceptions

```tsx
class CartNotFoundException extends DomainException {
  constructor(cartId: string) {
    super("CART_NOT_FOUND", "Cart not found", { cartId })
  }
}

class CartEmptyException extends DomainException {
  constructor(cartId: string) {
    super("CART_EMPTY", "Cart is empty", { cartId })
  }
}

class CartAlreadyCheckedOutException extends DomainException {
  constructor(cartId: string) {
    super("CART_ALREADY_CHECKED_OUT", "Cart already checked out", { cartId })
  }
}

class CartItemNotFoundException extends DomainException {
  constructor(itemId: string) {
    super("CART_ITEM_NOT_FOUND", "Cart item not found", { itemId })
  }
}

class InvalidCartItemQuantityException extends DomainException {
  constructor(quantity: number) {
    super("INVALID_CART_ITEM_QUANTITY", "Cart item quantity must be greater than zero", { quantity })
  }
}
```

---

## 21.11 Events

### ItemAddedToCart

```tsx
interface ItemAddedToCartPayload {
  cartId: string
  customerId: string
  productId: string
  quantity: number
}
```

### CartItemQuantityChanged

```tsx
interface CartItemQuantityChangedPayload {
  cartId: string
  itemId: string
  productId: string
  quantity: number
}
```

### VoucherAppliedToCart

```tsx
interface VoucherAppliedToCartPayload {
  cartId: string
  customerId: string
  voucherCode: string
  discountAmount: number
  finalAmount: number
}
```

### CartCheckedOut

```tsx
interface CartCheckedOutPayload {
  cartId: string
  customerId: string
  addressId: string
  paymentMethod: PaymentMethod
  checkoutRequestId: string
  items: {
    productId: string
    productName: string
    productImage?: string
    quantity: number
    priceSnapshot: number
    discountSnapshot: number
    finalPriceSnapshot: number
  }[]
  subtotalAmount: number
  discountAmount: number
  finalAmount: number
}
```

Tất cả event payload phải được bọc trong `IntegrationEvent` envelope có `tenantId`, `eventId`, `correlationId`, `aggregateId`, `aggregateType`.

---

## 21.12 HTTP API

```
GET    /api/v1/cart
POST   /api/v1/cart/items
PATCH  /api/v1/cart/items/:itemId
DELETE /api/v1/cart/items/:itemId
POST   /api/v1/cart/apply-voucher
DELETE /api/v1/cart/voucher
POST   /api/v1/cart/checkout
```

Mapping:

```
POST /api/v1/cart/items -> AddItemToCart
PATCH /api/v1/cart/items/:itemId -> UpdateCartItemQuantity
DELETE /api/v1/cart/items/:itemId -> RemoveCartItem
POST /api/v1/cart/apply-voucher -> ApplyVoucherToCart
POST /api/v1/cart/checkout -> CheckoutCart
```

---

## 21.13 Test Checklist

```
[ ] Add item creates active cart if none exists
[ ] Add same product increases quantity
[ ] Cannot add item to checked_out cart
[ ] Cannot add item with quantity <= 0
[ ] Apply valid voucher updates discount amount
[ ] Cannot apply voucher to empty cart
[ ] Checkout active cart succeeds
[ ] Checkout empty cart fails
[ ] Checkout checked_out cart fails
[ ] Checkout emits CartCheckedOut event
[ ] Checkout writes outbox event in same transaction
[ ] Tenant mismatch returns TENANT_ACCESS_DENIED
[ ] Duplicate checkoutRequestId is idempotent
```

---

# 22. Order Context — Backend Specification

## 22.1 Purpose

Order Context quản lý lifecycle của đơn hàng sau khi customer checkout cart.

Order là bản ghi nghiệp vụ đại diện cho cam kết mua hàng. Nó không phụ thuộc trạng thái hiện tại của Product, Pricing hoặc Cart sau thời điểm tạo order.

Vì vậy Order phải lưu snapshot dữ liệu quan trọng tại thời điểm tạo:

```
product name
product image
price
quantity
discount
tax
final price
```

---

## 22.2 Owned Data

Order Context sở hữu:

```
Order
OrderItem
Order status
Order snapshot
Order history
```

Order Context không sở hữu:

```
Cart
User
Product
Inventory
Payment
Shipment
Invoice
```

Các field như `customerId`, `cartId`, `invoiceId`, `shipmentId` nếu có chỉ là business reference.

---

## 22.3 Functional Groups

### Order Creation

- Create order from checked out cart
- Store order item snapshot
- Generate order code

### Order Lifecycle

- Confirm order
- Cancel order
- Mark order as paid
- Mark order as ready to ship
- Mark order as completed

### Order Query

- Get order detail
- Get order history
- Get order status

### Refund / Return Preparation

- Request refund
- Mark refund processing
- Mark refunded

---

## 22.4 Aggregate

```
Order (Aggregate Root)
 └── OrderItem
```

Order là transaction boundary.

OrderItem không được mutate trực tiếp từ application service.

---

## 22.5 Domain Types

```tsx
type OrderStatus =
  | "pending"
  | "confirmed"
  | "paid"
  | "ready_to_ship"
  | "shipped"
  | "completed"
  | "cancelled"
  | "refund_requested"
  | "refunded"

interface Order {
  id: string
  tenantId: string
  customerId: string
  cartId: string
  orderCode: string
  status: OrderStatus
  items: OrderItem[]
  totalAmount: number
  discountAmount: number
  taxAmount: number
  finalAmount: number
  createdAt: Date
  updatedAt: Date
  version: number
}

interface OrderItem {
  id: string
  productId: string
  productName: string
  productImage?: string
  price: number
  discount: number
  tax: number
  finalPrice: number
  quantity: number
}
```

---

## 22.6 Presentation Contracts

### GetOrderDetailResponse

```tsx
interface GetOrderDetailResponse {
  orderId: string
  orderCode: string
  status: OrderStatus
  items: {
    productId: string
    productName: string
    productImage?: string
    quantity: number
    finalPrice: number
  }[]
  totalAmount: number
  discountAmount: number
  taxAmount: number
  finalAmount: number
  createdAt: string
}
```

### CancelOrderRequest

```tsx
interface CancelOrderRequest {
  orderId: string     // required
  reason: string      // required
}

interface CancelOrderResponse {
  orderId: string
  status: "cancelled"
}
```

### RequestRefundRequest

```tsx
interface RequestRefundRequest {
  orderId: string     // required
  reason: string      // required
}

interface RequestRefundResponse {
  orderId: string
  status: "refund_requested"
}
```

---

## 22.7 Application Interfaces

```tsx
interface OrderRepository {
  save(order: Order): Promise<void>
  findById(tenantId: string, orderId: string): Promise<Order | null>
  findByCartId(tenantId: string, cartId: string): Promise<Order | null>
}

interface OrderCodeGenerator {
  generate(tenantId: string): Promise<string>
}

interface OrderQueryRepository {
  findOrderHistory(input: {
    tenantId: string
    customerId: string
    page: number
    limit: number
  }): Promise<OrderView[]>

  findOrderDetail(input: {
    tenantId: string
    orderId: string
  }): Promise<OrderDetailView | null>
}
```

---

## 22.8 Use Cases

### Use Case: CreateOrderFromCartCheckedOut

Trigger:

```
CartCheckedOut event
```

Validation:

- Event tenant must be valid.
- Order must not already exist for same cartId.
- CartCheckedOut event must be idempotent.
- Items must not be empty.
- Final amount must be greater than or equal to 0.

Transaction Boundary:

- Create Order aggregate.
- Store order item snapshot.
- Generate order code.
- Save order.
- Store OrderCreated event into outbox.

Published Events:

```
OrderCreated
```

Failure Cases:

```
ORDER_ALREADY_EXISTS
INVALID_ORDER_ITEMS
INVALID_ORDER_AMOUNT
IDEMPOTENCY_CONFLICT
TENANT_ACCESS_DENIED
```

---

### Use Case: ConfirmOrder

Trigger:

```
InventoryReserved event
```

Validation:

- Order must exist.
- Order status must be pending.
- Inventory reservation must match order items.

Transaction Boundary:

- Change status to confirmed.
- Save order.
- Store OrderConfirmed event into outbox.

Published Events:

```
OrderConfirmed
```

Failure Cases:

```
ORDER_NOT_FOUND
ORDER_CANNOT_CONFIRM
INVENTORY_RESERVATION_MISMATCH
```

---

### Use Case: MarkOrderPaid

Trigger:

```
PaymentSucceeded event
```

Validation:

- Order must exist.
- Order must not be cancelled.
- Paid amount must match order final amount.

Published Events:

```
OrderPaid
```

Failure Cases:

```
ORDER_NOT_FOUND
ORDER_ALREADY_CANCELLED
PAYMENT_AMOUNT_MISMATCH
ORDER_CANNOT_MARK_PAID
```

---

### Use Case: CancelOrder

Actor:

```
Customer or Admin
```

Input:

```
orderId: required
reason: required
```

Validation:

- Order must exist.
- Order must belong to tenant.
- Customer can cancel only own order.
- Order must not be shipped, completed, cancelled, or refunded.

Transaction Boundary:

- Change order status to cancelled.
- Store OrderCancelled event into outbox.

Published Events:

```
OrderCancelled
```

Failure Cases:

```
ORDER_NOT_FOUND
ORDER_ALREADY_CANCELLED
ORDER_CANNOT_CANCEL
TENANT_ACCESS_DENIED
```

---

### Use Case: RequestRefund

Actor:

```
Customer
```

Validation:

- Order must exist.
- Order must belong to customer.
- Order must be paid or completed.
- Order must not already be refunded.

Published Events:

```
OrderRefundRequested
```

Failure Cases:

```
ORDER_NOT_FOUND
ORDER_CANNOT_REFUND
ORDER_ALREADY_REFUNDED
TENANT_ACCESS_DENIED
```

---

## 22.9 Domain Behavior

```tsx
class OrderAggregate {
  confirm(): void {
    if (this.status !== "pending") throw new OrderCannotConfirmException(this.id, this.status)
    this.status = "confirmed"
  }

  markPaid(amount: number): void {
    if (this.status === "cancelled") throw new OrderAlreadyCancelledException(this.id)
    if (amount !== this.finalAmount) throw new PaymentAmountMismatchException(this.id)
    this.status = "paid"
  }

  cancel(reason: string): void {
    if (["shipped", "completed", "cancelled", "refunded"].includes(this.status)) {
      throw new OrderCannotCancelException(this.id, this.status)
    }
    this.status = "cancelled"
  }

  requestRefund(reason: string): void {
    if (!["paid", "completed"].includes(this.status)) {
      throw new OrderCannotRefundException(this.id, this.status)
    }
    this.status = "refund_requested"
  }
}
```

---

## 22.10 Domain Exceptions

```tsx
class OrderNotFoundException extends DomainException {
  constructor(orderId: string) {
    super("ORDER_NOT_FOUND", "Order not found", { orderId })
  }
}

class OrderCannotCancelException extends DomainException {
  constructor(orderId: string, status: string) {
    super("ORDER_CANNOT_CANCEL", "Order cannot be cancelled in current status", { orderId, status })
  }
}

class OrderCannotConfirmException extends DomainException {
  constructor(orderId: string, status: string) {
    super("ORDER_CANNOT_CONFIRM", "Order cannot be confirmed in current status", { orderId, status })
  }
}

class OrderAlreadyCancelledException extends DomainException {
  constructor(orderId: string) {
    super("ORDER_ALREADY_CANCELLED", "Order already cancelled", { orderId })
  }
}

class PaymentAmountMismatchException extends DomainException {
  constructor(orderId: string) {
    super("PAYMENT_AMOUNT_MISMATCH", "Payment amount does not match order amount", { orderId })
  }
}
```

---

## 22.11 Events

### OrderCreated

```tsx
interface OrderCreatedPayload {
  orderId: string
  orderCode: string
  cartId: string
  customerId: string
  items: {
    productId: string
    productName: string
    productImage?: string
    quantity: number
    price: number
    discount: number
    tax: number
    finalPrice: number
  }[]
  totalAmount: number
  discountAmount: number
  taxAmount: number
  finalAmount: number
}
```

### OrderConfirmed

```tsx
interface OrderConfirmedPayload {
  orderId: string
  orderCode: string
  customerId: string
}
```

### OrderCancelled

```tsx
interface OrderCancelledPayload {
  orderId: string
  orderCode: string
  customerId: string
  reason: string
}
```

### OrderRefundRequested

```tsx
interface OrderRefundRequestedPayload {
  orderId: string
  orderCode: string
  customerId: string
  reason: string
  amount: number
}
```

---

## 22.12 HTTP API

```
GET  /api/v1/orders
GET  /api/v1/orders/:orderId
POST /api/v1/orders/:orderId/cancel
POST /api/v1/orders/:orderId/refund-request
```

Mapping:

```
GET /api/v1/orders -> GetOrderHistory
GET /api/v1/orders/:orderId -> GetOrderDetail
POST /api/v1/orders/:orderId/cancel -> CancelOrder
POST /api/v1/orders/:orderId/refund-request -> RequestRefund
```

Order creation không expose trực tiếp qua public HTTP API ở flow chuẩn. Nó được tạo từ `CartCheckedOut` event.

---

## 22.13 Test Checklist

```
[ ] Create order from CartCheckedOut event succeeds
[ ] Duplicate CartCheckedOut does not create duplicate order
[ ] Order item snapshot is immutable
[ ] Confirm pending order succeeds
[ ] Confirm non-pending order fails
[ ] Mark paid with correct amount succeeds
[ ] Mark paid with wrong amount fails
[ ] Cancel pending order succeeds
[ ] Cancel shipped order fails
[ ] Request refund for paid order succeeds
[ ] Request refund for pending order fails
[ ] Tenant mismatch returns TENANT_ACCESS_DENIED
[ ] OrderCreated event is written to outbox
```

---

# 23. Inventory Context — Backend Specification

## 23.1 Purpose

Inventory Context quản lý tồn kho và reservation cho product theo từng tenant.

Nhiệm vụ chính là chống oversell khi nhiều customer checkout cùng lúc. Inventory Context không sở hữu Product. `productId` chỉ là business reference sang Catalog Context.

---

## 23.2 Owned Data

Inventory Context sở hữu:

- ProductInventory
- InventoryReservation
- InventoryAdjustment
- Inventory stock state

Inventory Context không sở hữu:

- Product
- Order
- Cart
- Payment

---

## 23.3 Functional Groups

### Inventory Management

- Create inventory record
- Adjust stock
- Mark inventory active / inactive
- View stock by product

### Inventory Reservation

- Reserve stock
- Release reservation
- Confirm deduction
- Expire reservation

### Inventory Query

- Get available stock
- Get reserved stock
- Get low stock list

---

## 23.4 Aggregate

```
ProductInventory (Aggregate Root)
 └── InventoryReservation
```

ProductInventory là transaction boundary.

Mọi thao tác reserve, release và confirm deduction phải đi qua ProductInventory aggregate.

---

## 23.5 Domain Types

```tsx
type InventoryStatus = "active" | "inactive" | "out_of_stock"

type ReservationStatus = "reserved" | "released" | "confirmed" | "expired"

interface ProductInventory {
  id: string
  tenantId: string
  productId: string
  quantity: number
  reservedQuantity: number
  warehouse?: string
  status: InventoryStatus
  createdAt: Date
  updatedAt: Date
  version: number
}

interface InventoryReservation {
  id: string
  reservationId: string
  orderId: string
  productId: string
  quantity: number
  status: ReservationStatus
  expiresAt?: Date
  createdAt: Date
}
```

Available stock:

```
available_quantity = quantity - reserved_quantity
```

---

## 23.6 Use Cases

### ReserveInventory

Trigger:

```
OrderCreated event
```

Validation:

- Event tenant must be valid.
- Reservation must be idempotent by reservationId.
- Inventory must exist for every product.
- Available quantity must be enough.
- Inventory status must be active.

Transaction Boundary:

- Load inventory rows for all order items.
- Check available quantity.
- Increase reservedQuantity.
- Create InventoryReservation.
- Save inventory.
- Store InventoryReserved event into outbox.

Published Events:

```
InventoryReserved
```

Failure Cases:

```
INVENTORY_NOT_FOUND
INSUFFICIENT_STOCK
INVENTORY_INACTIVE
INVENTORY_ALREADY_RESERVED
IDEMPOTENCY_CONFLICT
TENANT_ACCESS_DENIED
```

---

### ReleaseInventory

Trigger:

```
PaymentFailed event
OrderCancelled event
CheckoutSagaFailed event
```

Validation:

- Reservation must exist.
- Reservation status must be reserved.
- Release must be idempotent.

Published Events:

```
InventoryReleased
```

Failure Cases:

```
RESERVATION_NOT_FOUND
RESERVATION_ALREADY_RELEASED
INVALID_RESERVATION_STATE
```

---

### ConfirmInventoryDeduction

Trigger:

```
PaymentSucceeded event
```

Validation:

- Reservation must exist.
- Reservation status must be reserved.
- Quantity must still be valid.
- Deduction must be idempotent by reservationId.

Transaction Boundary:

- Decrease quantity.
- Decrease reservedQuantity.
- Mark reservation as confirmed.
- Save inventory.
- Store InventoryDeducted event into outbox.

Published Events:

```
InventoryDeducted
```

Failure Cases:

```
RESERVATION_NOT_FOUND
INVALID_RESERVATION_STATE
INVENTORY_DEDUCTION_FAILED
IDEMPOTENCY_CONFLICT
```

---

### AdjustStock

Actor:

```
Admin / Backoffice
```

Validation:

- Inventory must exist.
- Final quantity must not be negative.
- Final quantity must not be less than reservedQuantity.
- Reason is required for audit.

Published Events:

```
InventoryAdjusted
OutOfStockDetected
```

Failure Cases:

```
INVENTORY_NOT_FOUND
INVALID_STOCK_QUANTITY
RESERVED_QUANTITY_EXCEEDED
TENANT_ACCESS_DENIED
```

---

## 23.7 Application Interfaces

```tsx
interface InventoryRepository {
  save(inventory: ProductInventory): Promise<void>
  findByProductId(tenantId: string, productId: string): Promise<ProductInventory | null>
  findByReservationId(tenantId: string, reservationId: string): Promise<ProductInventory | null>
}

interface InventoryQueryRepository {
  getAvailableStock(tenantId: string, productId: string): Promise<number>
  findLowStock(input: { tenantId: string; threshold: number }): Promise<InventoryView[]>
}
```

---

## 23.8 Domain Exceptions

```tsx
class InventoryNotFoundException extends DomainException {
  constructor(productId: string) {
    super("INVENTORY_NOT_FOUND", "Inventory not found", { productId })
  }
}

class InsufficientStockException extends DomainException {
  constructor(productId: string) {
    super("INSUFFICIENT_STOCK", "Insufficient stock", { productId })
  }
}

class InventoryInactiveException extends DomainException {
  constructor(productId: string) {
    super("INVENTORY_INACTIVE", "Inventory is inactive", { productId })
  }
}

class InvalidReservationStateException extends DomainException {
  constructor(reservationId: string) {
    super("INVALID_RESERVATION_STATE", "Invalid reservation state", { reservationId })
  }
}
```

---

## 23.9 Events

### InventoryReserved

```tsx
interface InventoryReservedPayload {
  orderId: string
  reservationId: string
  items: {
    productId: string
    quantity: number
  }[]
}
```

### InventoryReleased

```tsx
interface InventoryReleasedPayload {
  orderId: string
  reservationId: string
}
```

### InventoryDeducted

```tsx
interface InventoryDeductedPayload {
  orderId: string
  reservationId: string
}
```

### InventoryAdjusted

```tsx
interface InventoryAdjustedPayload {
  productId: string
  quantityDelta: number
  reason: string
  finalQuantity: number
}
```

---

## 23.10 HTTP API

```
GET   /api/v1/inventory/:productId
POST  /api/v1/inventory/:productId/adjust
GET   /api/v1/inventory/low-stock
```

Reservation APIs are internal event handlers, not public customer APIs.

---

## 23.11 Test Checklist

```
[ ] Reserve stock succeeds when available stock is enough
[ ] Reserve stock fails when available stock is not enough
[ ] Duplicate reservationId does not reserve twice
[ ] Release reservation decreases reservedQuantity
[ ] Duplicate release is idempotent
[ ] Confirm deduction decreases quantity and reservedQuantity
[ ] Cannot adjust quantity below reservedQuantity
[ ] Concurrent reservation does not oversell
[ ] InventoryReserved event is written to outbox
[ ] Tenant mismatch returns TENANT_ACCESS_DENIED
```

---

# 24. Pricing & Promotion Context — Backend Specification

## 24.1 Purpose

Pricing & Promotion Context quản lý giá bán, discount, voucher và campaign theo từng tenant.

Context này chịu trách nhiệm tính toán giá hợp lệ tại thời điểm cart hoặc checkout cần pricing snapshot.

Pricing không sở hữu Product, Cart hay Order. Các field như `productId`, `cartId`, `customerId` chỉ là business reference.

---

## 24.2 Owned Data

Pricing Context sở hữu:

- ProductDiscount
- Voucher
- VoucherUsage
- PromotionCampaign
- Pricing rule state

Pricing Context không sở hữu:

- Product
- Cart
- Order
- Customer
- Inventory

---

## 24.3 Functional Groups

### Discount Management

- Create product discount
- Update product discount
- Activate discount
- Expire discount
- Get active discount by product

### Voucher Management

- Create voucher
- Update voucher
- Activate voucher
- Expire voucher
- Validate voucher
- Track voucher usage

### Pricing Calculation

- Calculate product price
- Calculate cart discount
- Return pricing snapshot

---

## 24.4 Aggregate

```
Voucher (Aggregate Root)
ProductDiscount (Aggregate Root)
```

Voucher là transaction boundary cho validate usage, increase used count và expire voucher.

ProductDiscount là transaction boundary cho discount rule theo product.

---

## 24.5 Domain Types

```tsx
type DiscountType = "percentage" | "fixed_amount"

type PromotionStatus = "draft" | "active" | "expired" | "disabled"

interface Voucher {
  id: string
  tenantId: string
  code: string
  discountType: DiscountType
  value: number
  maxUsage: number
  usedCount: number
  minOrderAmount?: number
  maxDiscountAmount?: number
  startDate: Date
  endDate: Date
  status: PromotionStatus
  createdAt: Date
  updatedAt: Date
  version: number
}

interface ProductDiscount {
  id: string
  tenantId: string
  productId: string
  discountType: DiscountType
  value: number
  startDate: Date
  endDate: Date
  status: PromotionStatus
}

interface PriceCalculation {
  originalAmount: number
  discountAmount: number
  taxAmount: number
  finalAmount: number
}
```

---

## 24.6 Use Cases

### ValidateVoucher

Actor:

```
Cart Context / Customer
```

Input:

```
voucherCode: required
customerId: required
cartId: required
subtotalAmount: required
```

Validation:

- Voucher must exist in tenant.
- Voucher status must be active.
- Current time must be within startDate and endDate.
- usedCount must be less than maxUsage.
- subtotalAmount must satisfy minOrderAmount if configured.
- Voucher must not violate customer usage rule.

Output:

```tsx
interface VoucherValidationResult {
  valid: boolean
  voucherCode: string
  discountAmount: number
  reason?: string
}
```

Failure Cases:

```
VOUCHER_NOT_FOUND
VOUCHER_INVALID
VOUCHER_EXPIRED
VOUCHER_USAGE_EXCEEDED
VOUCHER_MIN_ORDER_NOT_REACHED
TENANT_ACCESS_DENIED
```

---

### CalculateProductPrice

Actor:

```
Cart Context / Product Query
```

Input:

```
productId: required
quantity: required
```

Validation:

- Product reference must be provided.
- Quantity must be greater than 0.
- Active product discount is optional.

Output:

```tsx
interface ProductPriceSnapshot {
  productId: string
  quantity: number
  originalPrice: number
  discountAmount: number
  finalPrice: number
}
```

---

### CommitVoucherUsage

Trigger:

```
OrderCreated event or PaymentSucceeded event, depending on chosen policy
```

Validation:

- Voucher must exist.
- Voucher must still be active.
- Usage must be idempotent by orderId.
- usedCount must not exceed maxUsage.

Published Events:

```
VoucherUsageCommitted
```

Failure Cases:

```
VOUCHER_NOT_FOUND
VOUCHER_USAGE_EXCEEDED
VOUCHER_USAGE_ALREADY_COMMITTED
IDEMPOTENCY_CONFLICT
```

---

## 24.7 Discount Rules

### Stacking Policy

MVP sử dụng rule đơn giản:

- ProductDiscount được áp dụng trước.
- Voucher được áp dụng sau trên subtotal sau product discount.
- Không cho stack nhiều voucher trong cùng một cart.
- Voucher phải thuộc cùng tenant với cart.
- Discount amount không được làm finalAmount âm.
- Nếu discount vượt quá subtotal, finalAmount tối thiểu là 0 trước khi cộng tax.

### Formula

```
subtotal = sum(item.originalPrice * quantity)
productDiscountTotal = sum(product discount per item)
voucherDiscount = calculate voucher discount after product discount
finalAmount = subtotal - productDiscountTotal - voucherDiscount + taxAmount
```

---

## 24.8 Domain Exceptions

Pricing Context chuẩn hóa các exception sau:

```
VOUCHER_NOT_FOUND
VOUCHER_INVALID
VOUCHER_EXPIRED
VOUCHER_USAGE_EXCEEDED
VOUCHER_MIN_ORDER_NOT_REACHED
VOUCHER_USAGE_ALREADY_COMMITTED
DISCOUNT_NOT_FOUND
DISCOUNT_EXPIRED
INVALID_DISCOUNT_VALUE
```

Mapping chính:

- Voucher không tồn tại → VOUCHER_NOT_FOUND
- Voucher hết hạn → VOUCHER_EXPIRED
- Voucher vượt lượt dùng → VOUCHER_USAGE_EXCEEDED
- Đơn hàng chưa đạt min amount → VOUCHER_MIN_ORDER_NOT_REACHED
- Commit usage bị lặp → VOUCHER_USAGE_ALREADY_COMMITTED
- Discount value không hợp lệ → INVALID_DISCOUNT_VALUE

---

## 24.9 Events

### VoucherValidated

```tsx
interface VoucherValidatedPayload {
  voucherCode: string
  cartId: string
  customerId: string
  discountAmount: number
}
```

### VoucherUsageCommitted

```tsx
interface VoucherUsageCommittedPayload {
  voucherCode: string
  orderId: string
  customerId: string
  discountAmount: number
}
```

### ProductDiscountActivated

```tsx
interface ProductDiscountActivatedPayload {
  discountId: string
  productId: string
  discountType: DiscountType
  value: number
}
```

---

## 24.10 Repository Interfaces

```tsx
interface VoucherRepository {
  save(voucher: Voucher): Promise<void>
  findByCode(tenantId: string, code: string): Promise<Voucher | null>
  findUsageByOrderId(tenantId: string, orderId: string): Promise<VoucherUsage | null>
}

interface ProductDiscountRepository {
  save(discount: ProductDiscount): Promise<void>
  findActiveByProductId(tenantId: string, productId: string): Promise<ProductDiscount | null>
}
```

---

## 24.11 HTTP API

```
POST /api/v1/vouchers
PATCH /api/v1/vouchers/:code
POST /api/v1/vouchers/:code/activate
POST /api/v1/vouchers/:code/expire
POST /api/v1/vouchers/validate

POST /api/v1/product-discounts
PATCH /api/v1/product-discounts/:discountId
POST /api/v1/product-discounts/:discountId/activate
POST /api/v1/product-discounts/:discountId/expire
```

Public customer flow chỉ nên gọi validate voucher qua Cart Context. Các API quản lý voucher/discount dành cho admin/backoffice.

---

## 24.12 Test Checklist

```
[ ] Validate active voucher succeeds
[ ] Expired voucher returns VOUCHER_EXPIRED
[ ] Usage exceeded voucher returns VOUCHER_USAGE_EXCEEDED
[ ] Min order rule is enforced
[ ] Product discount applies before voucher
[ ] Multiple vouchers in one cart are rejected
[ ] Discount cannot make finalAmount negative
[ ] CommitVoucherUsage is idempotent by orderId
[ ] Duplicate event does not increase usedCount twice
[ ] Tenant mismatch returns TENANT_ACCESS_DENIED
```

---

# 25. Payment / Invoice Context — Backend Specification

## 25.1 Purpose

Payment / Invoice Context quản lý invoice, payment transaction, COD confirmation và refund flow.

Context này không sở hữu Order. `orderId` chỉ là business reference sang Order Context.

---

## 25.2 Owned Data

Payment / Invoice Context sở hữu:

- Invoice
- PaymentTransaction
- RefundTransaction
- TaxItem
- Payment state

Không sở hữu:

- Order
- Cart
- Customer
- Shipment

---

## 25.3 Functional Groups

### Invoice Management

- Generate invoice
- Get invoice detail
- Mark invoice paid
- Mark invoice failed

### Payment Processing

- Initiate payment
- Confirm payment webhook
- Handle payment failed
- Reconcile payment

### Refund Processing

- Request refund
- Confirm refund
- Track refund state

---

## 25.4 Aggregate

```
Invoice (Aggregate Root)
 ├── PaymentTransaction
 └── RefundTransaction
```

Invoice là transaction boundary cho payment state.

PaymentTransaction đại diện cho một attempt thanh toán.

RefundTransaction đại diện cho một attempt hoàn tiền.

---

## 25.5 Domain Types

```tsx
type InvoiceStatus = "pending" | "paid" | "failed" | "refunded" | "cancelled"

type PaymentStatus = "initiated" | "succeeded" | "failed" | "cancelled"

type PaymentMethod = "cod" | "online"

interface Invoice {
  id: string
  tenantId: string
  orderId: string
  customerId: string
  totalAmount: number
  taxAmount: number
  finalAmount: number
  status: InvoiceStatus
  issuedAt: Date
  createdAt: Date
  updatedAt: Date
  version: number
}

interface PaymentTransaction {
  id: string
  tenantId: string
  invoiceId: string
  provider: string
  providerTransactionId?: string
  paymentMethod: PaymentMethod
  amount: number
  status: PaymentStatus
  createdAt: Date
  updatedAt: Date
}
```

---

## 25.6 Payment State Machine

```
pending
→ paid
→ refunded
```

Failure flow:

```
pending
→ failed
```

Cancellation flow:

```
pending
→ cancelled
```

Rules:

- Invoice đã paid không được paid lại.
- Invoice đã refunded không được refund lại.
- Failed payment có thể tạo payment attempt mới.
- Payment webhook phải idempotent theo providerTransactionId.
- COD payment chỉ confirmed khi CODCollected event được nhận từ Shipping Context.

---

## 25.7 Use Cases

### GenerateInvoice

Trigger:

```
OrderCreated event
```

Validation:

- Order reference must exist in event payload.
- Invoice must not already exist for orderId.
- Final amount must be greater than or equal to 0.

Published Events:

```
InvoiceGenerated
```

Failure Cases:

```
INVOICE_ALREADY_EXISTS
INVALID_INVOICE_AMOUNT
IDEMPOTENCY_CONFLICT
```

---

### ConfirmPayment

Trigger:

```
Payment provider webhook
```

Validation:

- Invoice must exist.
- Invoice status must be pending.
- Provider transaction must be unique.
- Paid amount must match invoice finalAmount.
- Webhook signature must be valid.

Published Events:

```
PaymentSucceeded
```

Failure Cases:

```
INVOICE_NOT_FOUND
PAYMENT_ALREADY_CONFIRMED
PAYMENT_AMOUNT_MISMATCH
INVALID_PAYMENT_SIGNATURE
IDEMPOTENCY_CONFLICT
```

---

### HandlePaymentFailed

Trigger:

```
Payment provider webhook
```

Validation:

- Invoice must exist.
- Invoice status must be pending.
- Provider transaction must be unique.
- Failure reason should be stored for audit.

Published Events:

```
PaymentFailed
```

Failure Cases:

```
INVOICE_NOT_FOUND
PAYMENT_ALREADY_CONFIRMED
IDEMPOTENCY_CONFLICT
```

---

### ConfirmCODCollected

Trigger:

```
CODCollected event
```

Validation:

- Invoice must exist.
- Payment method must be cod.
- Invoice status must be pending.
- Collected amount must match invoice finalAmount.

Published Events:

```
PaymentSucceeded
```

Failure Cases:

```
INVOICE_NOT_FOUND
INVALID_PAYMENT_METHOD
PAYMENT_AMOUNT_MISMATCH
PAYMENT_ALREADY_CONFIRMED
```

---

### RefundPayment

Trigger:

```
OrderRefundRequested event
```

Validation:

- Invoice must exist.
- Invoice status must be paid.
- Refund amount must not exceed paid amount.
- Refund must be idempotent by refundRequestId or orderId.

Published Events:

```
RefundCompleted
```

Failure Cases:

```
INVOICE_NOT_FOUND
INVOICE_NOT_PAID
REFUND_AMOUNT_EXCEEDED
REFUND_ALREADY_PROCESSED
IDEMPOTENCY_CONFLICT
```

---

## 25.8 Events

### InvoiceGenerated

```tsx
interface InvoiceGeneratedPayload {
  invoiceId: string
  orderId: string
  customerId: string
  finalAmount: number
}
```

### PaymentSucceeded

```tsx
interface PaymentSucceededPayload {
  invoiceId: string
  orderId: string
  providerTransactionId: string
  amount: number
}
```

### PaymentFailed

```tsx
interface PaymentFailedPayload {
  invoiceId: string
  orderId: string
  reason: string
}
```

### RefundCompleted

```tsx
interface RefundCompletedPayload {
  invoiceId: string
  orderId: string
  refundAmount: number
}
```

---

## 25.9 Domain Exceptions

```
INVOICE_NOT_FOUND
INVOICE_ALREADY_EXISTS
INVALID_INVOICE_AMOUNT
PAYMENT_ALREADY_CONFIRMED
PAYMENT_AMOUNT_MISMATCH
INVALID_PAYMENT_SIGNATURE
INVALID_PAYMENT_METHOD
INVOICE_NOT_PAID
REFUND_AMOUNT_EXCEEDED
REFUND_ALREADY_PROCESSED
IDEMPOTENCY_CONFLICT
```

---

## 25.10 Repository Interfaces

```tsx
interface InvoiceRepository {
  save(invoice: Invoice): Promise<void>
  findById(tenantId: string, invoiceId: string): Promise<Invoice | null>
  findByOrderId(tenantId: string, orderId: string): Promise<Invoice | null>
}

interface PaymentTransactionRepository {
  save(transaction: PaymentTransaction): Promise<void>
  findByProviderTransactionId(tenantId: string, providerTransactionId: string): Promise<PaymentTransaction | null>
}
```

---

## 25.11 HTTP API

```
GET  /api/v1/invoices/:invoiceId
GET  /api/v1/orders/:orderId/invoice
POST /api/v1/payments/initiate
POST /api/v1/payments/webhook/:provider
POST /api/v1/payments/refund
```

Webhook endpoint phải validate provider signature và xử lý idempotent bằng providerTransactionId.

---

## 25.12 Test Checklist

```
[ ] Generate invoice from OrderCreated succeeds
[ ] Duplicate OrderCreated does not create duplicate invoice
[ ] Confirm payment succeeds with valid provider transaction
[ ] Duplicate webhook does not mark paid twice
[ ] Payment amount mismatch returns PAYMENT_AMOUNT_MISMATCH
[ ] Invalid webhook signature returns INVALID_PAYMENT_SIGNATURE
[ ] Payment failed emits PaymentFailed
[ ] CODCollected confirms COD invoice
[ ] Refund paid invoice succeeds
[ ] Refund amount cannot exceed paid amount
[ ] Duplicate refund request is idempotent
[ ] Tenant mismatch returns TENANT_ACCESS_DENIED
```

---

# 26. Shipping Context — Backend Specification

## 26.1 Purpose

Shipping Context quản lý địa chỉ giao hàng, shipment lifecycle, tracking và COD collection.

Shipping không sở hữu Order, Invoice hoặc User. Các field như `orderId`, `invoiceId`, `customerId` là business reference.

---

## 26.2 Owned Data

Shipping Context sở hữu:

- CustomerAddress
- Shipment
- ShipmentTracking
- COD
- Delivery state

Shipping Context không sở hữu:

- Order
- Invoice
- Payment
- User

---

## 26.3 Functional Groups

### Address Management

- Create customer address
- Update customer address
- Set default address
- Get customer addresses

### Shipment Management

- Create shipment
- Assign shipping method
- Update shipment status
- Track shipment
- Mark delivery failed

### COD Management

- Create COD record
- Confirm COD collected
- Mark COD failed

---

## 26.4 Aggregate

```
Shipment (Aggregate Root)
 ├── ShipmentTracking
 └── COD

CustomerAddress (Aggregate Root)
```

Shipment là transaction boundary cho delivery lifecycle.

CustomerAddress là aggregate riêng vì address có lifecycle độc lập với shipment.

---

## 26.5 Domain Types

```tsx
type ShipmentStatus =
  | "pending"
  | "created"
  | "in_transit"
  | "delivered"
  | "failed"
  | "cancelled"

type CODStatus = "pending" | "collected" | "failed"

interface Shipment {
  id: string
  tenantId: string
  orderId: string
  customerId: string
  addressId: string
  status: ShipmentStatus
  shippingMethod: string
  trackingCode?: string
  createdAt: Date
  updatedAt: Date
  version: number
}

interface CustomerAddress {
  id: string
  tenantId: string
  customerId: string
  receiverName: string
  phone: string
  address: string
  city: string
  country: string
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

interface COD {
  id: string
  tenantId: string
  shipmentId: string
  amount: number
  status: CODStatus
  collectedAt?: Date
}
```

---

## 26.6 Shipment State Machine

```
pending
→ created
→ in_transit
→ delivered
```

Failure flow:

```
created / in_transit
→ failed
```

Cancellation flow:

```
pending / created
→ cancelled
```

Rules:

- Delivered shipment không được chuyển ngược về pending.
- Cancelled shipment không được delivered.
- COD chỉ được collected khi shipment delivered hoặc carrier xác nhận đã thu tiền.
- Tracking update từ carrier phải idempotent theo tracking event id nếu có.

---

## 26.7 Use Cases

### CreateShipment

Trigger:

```
PaymentSucceeded event or OrderConfirmed event for COD flow
```

Validation:

- Shipment must not already exist for orderId.
- Address reference must be valid.
- Shipping method must be supported.
- Tenant context must match event tenant.

Published Events:

```
ShipmentCreated
```

Failure Cases:

```
SHIPMENT_ALREADY_EXISTS
INVALID_SHIPPING_ADDRESS
INVALID_SHIPPING_METHOD
TENANT_ACCESS_DENIED
```

---

### UpdateShipmentStatus

Trigger:

```
Carrier webhook or Admin action
```

Validation:

- Shipment must exist.
- Status transition must be valid.
- Carrier event must be idempotent if event id exists.

Published Events:

```
ShipmentStatusChanged
```

Failure Cases:

```
SHIPMENT_NOT_FOUND
INVALID_SHIPMENT_STATUS_TRANSITION
DUPLICATE_CARRIER_EVENT
```

---

### ConfirmCODCollected

Trigger:

```
Carrier webhook or Admin action
```

Validation:

- Shipment must exist.
- COD record must exist.
- COD must not already be collected.
- Collected amount must match COD amount.

Published Events:

```
CODCollected
```

Failure Cases:

```
SHIPMENT_NOT_FOUND
COD_NOT_FOUND
COD_ALREADY_COLLECTED
COD_AMOUNT_MISMATCH
```

---

## 26.8 Events

### ShipmentCreated

```tsx
interface ShipmentCreatedPayload {
  shipmentId: string
  orderId: string
  customerId: string
  trackingCode?: string
}
```

### ShipmentStatusChanged

```tsx
interface ShipmentStatusChangedPayload {
  shipmentId: string
  orderId: string
  status: ShipmentStatus
  trackingCode?: string
}
```

### ShipmentDelivered

```tsx
interface ShipmentDeliveredPayload {
  shipmentId: string
  orderId: string
  deliveredAt: string
}
```

### CODCollected

```tsx
interface CODCollectedPayload {
  shipmentId: string
  orderId: string
  amount: number
  collectedAt: string
}
```

---

## 26.9 Domain Exceptions

```
SHIPMENT_NOT_FOUND
SHIPMENT_ALREADY_EXISTS
INVALID_SHIPPING_ADDRESS
INVALID_SHIPPING_METHOD
INVALID_SHIPMENT_STATUS_TRANSITION
DUPLICATE_CARRIER_EVENT
COD_NOT_FOUND
COD_ALREADY_COLLECTED
COD_AMOUNT_MISMATCH
TENANT_ACCESS_DENIED
```

---

## 26.10 Repository Interfaces

```tsx
interface ShipmentRepository {
  save(shipment: Shipment): Promise<void>
  findById(tenantId: string, shipmentId: string): Promise<Shipment | null>
  findByOrderId(tenantId: string, orderId: string): Promise<Shipment | null>
}

interface CustomerAddressRepository {
  save(address: CustomerAddress): Promise<void>
  findById(tenantId: string, addressId: string): Promise<CustomerAddress | null>
  findByCustomerId(tenantId: string, customerId: string): Promise<CustomerAddress[]>
}
```

---

## 26.11 HTTP API

```
POST   /api/v1/addresses
PATCH  /api/v1/addresses/:addressId
GET    /api/v1/customers/:customerId/addresses

GET    /api/v1/shipments/:shipmentId
GET    /api/v1/orders/:orderId/shipment
POST   /api/v1/shipments/:shipmentId/status
POST   /api/v1/shipments/carrier/webhook
```

Carrier webhook endpoint phải validate provider payload và xử lý idempotent theo carrier event id nếu có.

---

## 26.12 Test Checklist

```
[ ] Create shipment from PaymentSucceeded succeeds
[ ] Duplicate shipment creation is idempotent
[ ] Invalid shipment status transition is rejected
[ ] Carrier duplicate webhook does not update twice
[ ] Delivered shipment cannot transition back to pending
[ ] COD collected succeeds once only
[ ] COD collected amount must match COD amount
[ ] Invalid shipping address returns INVALID_SHIPPING_ADDRESS
[ ] Shipment status change emits ShipmentStatusChanged
[ ] Tenant mismatch returns TENANT_ACCESS_DENIED
```

---

# 27. Implementation Strategy

## 27.1 Backend Module Structure

Giai đoạn MVP nên triển khai theo modular monolith trước, tách module theo bounded context.

```
src/
  modules/
    user/
    catalog/
    inventory/
    pricing/
    cart/
    order/
    payment/
    shipping/
  shared/
    domain/
    application/
    infrastructure/
```

Mỗi module có cấu trúc:

```
context/
  domain/
    aggregates/
    entities/
    value-objects/
    events/
    exceptions/
  application/
    use-cases/
    ports/
    dto/
  infrastructure/
    repositories/
    event-handlers/
    persistence/
  presentation/
    controllers/
    request-response/
```

---

## 27.2 Deployment Strategy

MVP không nên tách microservice vật lý quá sớm.

Chiến lược khuyến nghị:

```
Phase 1: Modular Monolith + database schema per context
Phase 2: Split worker for outbox / async event handling
Phase 3: Extract high-pressure contexts if needed
```

Các context nên tách trước nếu cần scale:

- Catalog search
- Inventory reservation
- Payment webhook processing
- Shipping carrier integration

---

## 27.3 Shared Kernel Rules

Shared Kernel chỉ chứa thứ thật sự chung:

- EntityId
- TenantContext
- DomainEvent
- IntegrationEvent
- DomainException
- Money value object
- Pagination type

Không đưa business logic riêng của context vào shared kernel.

Nếu shared kernel phình to, nó sẽ biến thành thùng rác có type an toàn. Một bi kịch hiện đại.

---

# 28. CQRS & Read Model Strategy

## 28.1 CQRS Lite

MVP sử dụng CQRS Lite, không tách read/write service vật lý quá sớm.

Nguyên tắc:

- Command đi qua aggregate và domain rule.
- Query đọc từ repository hoặc read model riêng.
- Không dùng query để mutate state.
- Không expose aggregate trực tiếp ra response.

---

## 28.2 Read Model Candidates

Các read model nên có:

- ProductSearchView
- CartSummaryView
- OrderDetailView
- OrderHistoryView
- InventoryStockView
- PaymentStatusView
- ShipmentTrackingView

Read model được build từ event consumer, không join runtime xuyên database.

---

## 28.3 Projection Rules

Projection handler phải:

- Idempotent theo eventId.
- Có inbox_event để tránh xử lý trùng.
- Có thể rebuild từ event hoặc từ source database snapshot.
- Luôn có tenantId.
- Không chứa business rule phức tạp.

Nếu projection có quá nhiều business rule, nghĩa là domain logic đang bị vứt nhầm chỗ. Một kiểu giấu rác dưới thảm, nhưng thảm là production.

---

## 28.4 Query API Rule

Query API được phép tối ưu cho UI:

- Có thể denormalize.
- Có thể dùng cache.
- Có thể dùng search index.
- Không được mutate aggregate state.

Ví dụ:

```
GET /api/v1/products/search -> ProductSearchView
GET /api/v1/orders -> OrderHistoryView
GET /api/v1/orders/:id -> OrderDetailView
GET /api/v1/shipments/:id/tracking -> ShipmentTrackingView
```

---

# 29. Observability & Resiliency Strategy

## 29.1 Logging Rules

Mọi request và event handler phải log theo structured logging.

Log tối thiểu gồm:

- requestId
- correlationId
- causationId
- tenantId
- userId nếu có
- context
- useCase
- aggregateId nếu có
- eventId nếu có

Không log password, token, payment secret hoặc sensitive payload. Ghi log kiểu vô tư rồi gọi đó là observability là một bi kịch rất đắt tiền.

---

## 29.2 Distributed Tracing

Mỗi request hoặc event chain phải mang correlationId.

Ví dụ:

```
Checkout request
→ CartCheckedOut
→ OrderCreated
→ InventoryReserved
→ InvoiceGenerated
→ PaymentSucceeded
→ ShipmentCreated
```

Tất cả step trên phải trace được bằng cùng correlationId.

---

## 29.3 Retry Policy

Retry chỉ áp dụng cho lỗi tạm thời:

- network timeout
- broker unavailable
- provider temporary error
- database deadlock

Không retry cho lỗi domain:

- INSUFFICIENT_STOCK
- VOUCHER_EXPIRED
- PAYMENT_AMOUNT_MISMATCH
- TENANT_ACCESS_DENIED

Retry sai chỗ chỉ là cách tự động hóa việc phá hệ thống.

---

## 29.4 Dead Letter Queue

Event xử lý thất bại nhiều lần phải được đưa vào DLQ.

DLQ record nên có:

- eventId
- eventType
- tenantId
- payload
- errorCode
- errorMessage
- retryCount
- failedAt

DLQ phải có admin/replay tool ở phase sau MVP.

---

## 29.5 Metrics

Các metric nên theo dõi:

- checkout_success_count
- checkout_failed_count
- inventory_reservation_failed_count
- payment_success_count
- payment_failed_count
- shipment_failed_count
- outbox_pending_count
- outbox_failed_count
- event_consumer_lag
- api_latency_p95
- api_error_rate

---

# 30. Auth & Security Strategy

## 30.1 Authentication Flow

MVP sử dụng JWT access token + refresh token.

Authentication flow:

```
Register / Login
→ Validate credential
→ Issue access token + refresh token
→ Store refresh token hash / session record
→ Client calls API with Authorization header
→ TenantContext is built from token claims
```

Access token nên chứa tối thiểu:

- userId
- tenantId
- sessionId
- issuedAt
- expiresAt

Không lấy `tenantId` từ request body. Tin client trong multi-tenant SaaS là một cách rất nhanh để biến sản phẩm thành vụ rò rỉ dữ liệu.

---

## 30.2 Authorization Scope for MVP

Giai đoạn MVP chưa cần RBAC/ABAC phức tạp.

Dùng scope đơn giản:

- customer
- tenant_admin
- internal_system

Rules:

- Customer chỉ truy cập tài nguyên của chính mình.
- Tenant admin chỉ truy cập tài nguyên trong tenant của mình.
- Internal system dùng cho event worker và background job.

---

## 30.3 Tenant Isolation Rules

Mọi API, command, query, event handler phải kiểm tra tenant boundary.

Bắt buộc:

- Repository method luôn nhận tenantId.
- Query luôn filter tenantId.
- Event payload luôn có tenantId trong envelope.
- Projection/read model luôn có tenantId.
- Không dùng global unique email nếu nghiệp vụ cho phép email trùng giữa tenant.

---

## 30.4 Sensitive Data Rules

Không log:

- password
- passwordHash
- refreshToken
- accessToken
- payment secret
- provider signature
- full webhook raw secret

Password phải hash bằng bcrypt hoặc argon2.

Refresh token nên lưu dạng hash, không lưu plain text.

---

## 30.5 Security Error Codes

```
UNAUTHENTICATED
ACCESS_TOKEN_EXPIRED
REFRESH_TOKEN_EXPIRED
INVALID_CREDENTIALS
TENANT_ACCESS_DENIED
SESSION_REVOKED
INSUFFICIENT_SCOPE
```

---

# 31. Cache & Search Strategy

## 31.1 Cache Strategy

Cache chỉ dùng để tối ưu read/query, không dùng làm source of truth.

Ứng viên nên cache:

- ProductSearchView
- ProductDetailView
- CartSummaryView
- ActiveDiscountView
- InventoryStockView dạng read-only gần realtime

Không cache bừa các dữ liệu nhạy cảm như token, password hash, payment secret hoặc raw webhook payload.

---

## 31.2 Cache Invalidation

Invalidation nên dựa trên event:

```
ProductUpdated → invalidate product detail/search cache
InventoryAdjusted → invalidate stock view cache
DiscountStarted / DiscountExpired → invalidate pricing cache
CartItemQuantityChanged → invalidate cart summary cache
```

TTL chỉ là lớp phòng thủ phụ, không phải chiến lược consistency chính.

---

## 31.3 Search Strategy

MVP có thể dùng database query cho product search đơn giản.

Khi cần scale, tách ProductSearchView sang Elasticsearch hoặc OpenSearch.

Search index nên nhận event từ Catalog / Pricing / Inventory:

```
ProductPublished
ProductUpdated
ProductArchived
DiscountStarted
DiscountExpired
InventoryAdjusted
OutOfStockDetected
```

---

## 31.4 Search Document

```tsx
interface ProductSearchDocument {
  tenantId: string
  productId: string
  name: string
  description?: string
  catalogId: string
  image?: string
  price: number
  discountAmount?: number
  finalPrice: number
  stockStatus: "in_stock" | "out_of_stock"
  status: "published" | "archived"
}
```

Search document là read model, không phải domain model. Nhầm hai thứ này là cách biến search engine thành database phụ đầy lời nói dối.

---

# 32. Testing & CI/CD Strategy

## 32.1 Testing Pyramid

Hệ thống nên ưu tiên testing theo thứ tự:

```
Unit Test
→ Application Use Case Test
→ Repository Integration Test
→ Event Handler Integration Test
→ API Contract Test
→ End-to-End Test
```

Không dùng E2E để thay thế unit test. E2E chậm, dễ flake và thường chỉ báo “có gì đó cháy” chứ không nói cháy ở đâu. Rất hữu ích nếu mục tiêu là đau khổ.

---

## 32.2 Domain Unit Test

Domain unit test tập trung vào aggregate invariant.

Ví dụ cần test:

- Cart không checkout được nếu empty.
- Order không cancel được nếu shipped.
- Inventory không reserve vượt available quantity.
- Voucher expired không được apply.
- Invoice paid không được paid lại.
- Shipment delivered không được rollback về pending.

---

## 32.3 Application Use Case Test

Use case test kiểm tra orchestration trong application layer:

- Repository được gọi đúng.
- Gateway được gọi đúng.
- Domain exception được throw đúng.
- Outbox event được ghi đúng.
- Tenant boundary được enforce.
- Idempotency key được xử lý đúng.

---

## 32.4 Event Handler Test

Event handler test phải bao gồm:

- Duplicate event không xử lý trùng.
- Invalid domain event không retry vô hạn.
- Inbox event được ghi sau khi xử lý thành công.
- Failed event được retry nếu là transient error.
- Failed event vào DLQ nếu vượt retry limit.

---

## 32.5 CI Pipeline

CI pipeline tối thiểu:

```
Install dependencies
→ Lint
→ Type check
→ Unit test
→ Integration test
→ Build
→ Migration validation
→ Docker image build
```

Main branch không được merge nếu fail type check hoặc test critical path.

---

## 32.6 Deployment Environments

MVP nên có:

- local
- development
- staging
- production

Staging phải có broker, database, worker và outbox flow giống production ở mức tối thiểu.

Không test event-driven system bằng cách bỏ qua broker ở staging. Đó là cách chuẩn bị cho production incident bằng niềm tin.

---

# 33. Kết luận

Đây là baseline phát triển Pet E-commerce theo DDD + Event-Driven Architecture, có chuẩn bị cho SaaS multi-tenant.

Thiết kế hiện tại ưu tiên:

- Đủ rõ để implement.
- Đủ sạch để mở rộng.
- Đủ đơn giản để không tự đốt project.

Các phần nên phát triển tiếp sau khi MVP ổn định:

- IAM / Authorization Context riêng.
- Tenant Management Context.
- Admin Dashboard read model.
- Advanced promotion engine.
- Full payment reconciliation.
- Return / Refund workflow chi tiết.

[Shipping Context — Backend Specification](Shipping%20Context%20%E2%80%94%20Backend%20Specification%20361b38678ea581b48ca8def2d05cd528.md)

[Product Catalog Context — Backend Specification](Product%20Catalog%20Context%20%E2%80%94%20Backend%20Specification%20361b38678ea581b59667e3f93a949de1.md)

[User Context — Backend Specification](User%20Context%20%E2%80%94%20Backend%20Specification%20361b38678ea58109970adf86e9c0b166.md)

[Shared Kernel & Common Contracts — Backend Specification](Shared%20Kernel%20&%20Common%20Contracts%20%E2%80%94%20Backend%20Specifi%20361b38678ea581c9969fcb712177e39b.md)

[Implementation Roadmap & Delivery Plan](Implementation%20Roadmap%20&%20Delivery%20Plan%20363b38678ea5814b95e8e8af8c0388ab.md)

[Engineering Task Backlog — Pet E-commerce](Engineering%20Task%20Backlog%20%E2%80%94%20Pet%20E-commerce%20363b38678ea58126aa74e5560af2dfb8.md)

[Architecture Decision Records — Pet E-commerce](Architecture%20Decision%20Records%20%E2%80%94%20Pet%20E-commerce%20363b38678ea5817688eef943aef04b48.md)

[UX Wireframe & User Flow Design — Pet E-commerce](UX%20Wireframe%20&%20User%20Flow%20Design%20%E2%80%94%20Pet%20E-commerce%20363b38678ea58126b952c1aa11b757ac.md)

[Test Strategy — Pet E-commerce](Test%20Strategy%20%E2%80%94%20Pet%20E-commerce%20363b38678ea581179b72efd7a2947ece.md)

[Interface & API Design — Pet E-commerce](Interface%20&%20API%20Design%20%E2%80%94%20Pet%20E-commerce%20363b38678ea581b49d5bfe7986d6bbf3.md)

[Database Schema & Migration Design — Pet E-commerce](Database%20Schema%20&%20Migration%20Design%20%E2%80%94%20Pet%20E-commerc%20363b38678ea5818988fdfdfe748baacd.md)

[Observability, Incident & Release Strategy — Pet E-commerce](Observability,%20Incident%20&%20Release%20Strategy%20%E2%80%94%20Pet%20E%20364b38678ea58154b4b1c3f71f5468bc.md)

[Frontend Architecture & UI Engineering Strategy — Pet E-commerce](Frontend%20Architecture%20&%20UI%20Engineering%20Strategy%20%E2%80%94%20%20364b38678ea5817d9896e56344d0f633.md)

[Infrastructure & Deployment Strategy — Pet E-commerce](Infrastructure%20&%20Deployment%20Strategy%20%E2%80%94%20Pet%20E-comme%20364b38678ea58139aba9fc7d1ba068fe.md)

[Security Architecture & Threat Modeling — Pet E-commerce](Security%20Architecture%20&%20Threat%20Modeling%20%E2%80%94%20Pet%20E-co%20364b38678ea581d3930dd2f91a605a7f.md)