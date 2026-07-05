# Shared Kernel & Common Contracts — Backend Specification

Trang con này chứa các contract dùng chung giữa các bounded context trong kiến trúc Modular Monolith định hướng Microservice-ready.

Mục tiêu là thống nhất common types, error contract, event envelope, tenant context, idempotency và rule giao tiếp giữa các module.

---

## 1. Architecture Decision

Hệ thống được triển khai theo hướng:

```
Modular Monolith first
DDD Bounded Contexts inside one deployable backend
Event-Driven internally
Microservice-ready, but not microservice-first
```

Hiện tại không triển khai mỗi bounded context thành một service riêng.

Lý do:

- Domain boundary còn đang học và thay đổi.
- Pet-project chưa có nhu cầu scale độc lập từng service.
- Distributed transaction sẽ làm complexity tăng quá sớm.
- Debug, deploy, tracing và observability sẽ nặng không cần thiết.
- Modular Monolith vẫn giữ được boundary rõ mà không tự mua đau khổ distributed system.

Microservice extraction chỉ là lựa chọn tương lai khi boundary đã chín.

---

## 2. Shared Kernel Principles

Shared Kernel phải mỏng, ổn định và không chứa business logic riêng của bounded context.

Được phép đặt trong Shared Kernel:

- TenantContext
- RequestContext
- BaseEntity
- Value object rất chung
- Result / Error contract
- IntegrationEvent envelope
- Pagination contract
- Idempotency contract
- Clock abstraction
- Outbox / Inbox contract

Không được đặt trong Shared Kernel:

- Product business rule
- Order state machine
- Payment rule
- Inventory reservation logic
- Shipping transition rule
- Voucher calculation logic
- Repository implementation cụ thể
- ORM model cụ thể

Shared Kernel không phải thùng rác `common/utils` đội vương miện.

---

## 3. Module Communication Rules

Trong Modular Monolith, các bounded context giao tiếp qua:

```
Application Interface
Domain Event
Integration Event
Read Model / Query Interface
```

Không được:

- Import trực tiếp aggregate của context khác.
- Query trực tiếp database table của context khác.
- Tạo foreign key xuyên bounded context trong production design.
- Share ORM entity giữa nhiều context.
- Gọi private repository của context khác.

Được phép:

- Gọi public application service interface.
- Consume event thông qua internal event bus.
- Đọc read model đã được expose rõ ràng.
- Dùng business reference ID như `productId`, `orderId`, `customerId`.

Rule chính:

```
Cross-context reference is by ID, not by object graph.
```

---

## 4. Common Base Types

```tsx
type ID = string

type ISODateTimeString = string

interface BaseEntity {
  id: ID
  tenantId: ID
  createdAt: Date
  updatedAt: Date
  version: number
}

interface TenantScoped {
  tenantId: ID
}

interface Auditable {
  createdAt: Date
  updatedAt: Date
}

interface Versioned {
  version: number
}
```

Quy tắc:

- Mọi aggregate root quan trọng phải có `tenantId`.
- `version` dùng cho optimistic locking.
- Không expose trực tiếp `BaseEntity` ra API response.
- API response nên dùng DTO riêng.

---

## 5. Result / Error Contract

Application layer có thể trả về result object hoặc throw domain exception tùy convention của codebase.

Dù chọn hướng nào, error response ở presentation layer phải thống nhất.

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

Domain exception chuẩn:

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

Error code phải ổn định, không phụ thuộc message text.

```
Frontend / workflow / monitoring must depend on error code, not message text.
```

---

## 6. Tenant Context

TenantContext là context bắt buộc cho mọi command/query cần tenant isolation.

```tsx
interface TenantContext {
  tenantId: ID
  tenantCode?: string
}
```

Quy tắc:

- `tenantId` không lấy từ request body.
- `tenantId` được resolve từ auth token, subdomain, header nội bộ hoặc gateway.
- Application use case nhận TenantContext từ middleware/presentation layer.
- Repository query bắt buộc filter theo tenantId nếu entity là tenant-scoped.
- Không cho phép cross-tenant query nếu không có use case admin rõ ràng.

---

## 7. Request Context

RequestContext gom các metadata cần cho tracing, audit và event correlation.

```tsx
interface RequestContext extends TenantContext {
  userId?: ID
  correlationId: ID
  causationId?: ID
  requestId: ID
  ip?: string
  userAgent?: string
}
```

Quy tắc:

- `correlationId` đi xuyên toàn bộ flow.
- `causationId` dùng để biết event/command nào sinh ra action hiện tại.
- Mọi IntegrationEvent phải copy `correlationId` từ RequestContext.
- Log phải có `tenantId`, `correlationId`, `requestId`.

---

## 8. Pagination Contract

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

- `limit` phải có max limit để tránh query quá lớn.
- Public API không trả unbounded list.
- Cursor pagination có thể bổ sung sau cho feed/search lớn.

MVP dùng page/limit để đơn giản hóa implementation.

---

## 9. Clock Abstraction

Không gọi trực tiếp `new Date()` trong domain logic quan trọng.

Dùng Clock interface để test được business rule phụ thuộc thời gian.

```tsx
interface Clock {
  now(): Date
}
```

Use cases cần Clock:

- Voucher expiration
- Payment timeout
- Session expiration
- Reservation expiration
- Shipment delivery SLA

Quy tắc:

- Domain service nhận Clock qua dependency injection.
- Test có thể dùng FakeClock.
- Không hardcode system time trong aggregate method nếu rule cần deterministic test.

---

## 10. Idempotency Contract

Idempotency dùng để đảm bảo command/event retry không tạo duplicate mutation.

```tsx
interface IdempotencyRecord {
  id: ID
  tenantId: ID
  idempotencyKey: string
  operation: string
  requestHash?: string
  responseSnapshot?: unknown
  status: "processing" | "completed" | "failed"
  createdAt: Date
  expiresAt?: Date
}
```

Các use case bắt buộc có idempotency:

- CheckoutCart
- CreateOrderFromCartCheckedOut
- ReserveInventory
- CommitVoucherUsage
- ConfirmPayment webhook
- RefundPayment
- CreateShipment
- ConfirmCODCollected

Quy tắc:

- Idempotency key phải unique theo tenant + operation.
- Retry cùng key + cùng requestHash trả lại kết quả cũ nếu đã completed.
- Retry cùng key nhưng khác requestHash phải trả IDEMPOTENCY_CONFLICT.
- Idempotency record phải có TTL phù hợp với business flow.

---

## 11. Integration Event Envelope

Mọi event đi xuyên bounded context phải dùng envelope thống nhất.

```tsx
interface IntegrationEvent<TPayload> {
  eventId: ID
  eventName: string
  eventVersion: number
  occurredAt: ISODateTimeString
  tenantId: ID
  aggregateId: ID
  aggregateType: string
  correlationId: ID
  causationId?: ID
  producer: string
  payload: TPayload
}
```

Quy tắc:

- `eventId` phải unique toàn hệ thống.
- `eventName` dùng past tense, ví dụ `OrderCreated`, `PaymentSucceeded`.
- `eventVersion` bắt đầu từ 1.
- `occurredAt` lấy từ Clock.
- `tenantId` bắt buộc cho mọi tenant-scoped event.
- `correlationId` phải được truyền xuyên flow.
- Payload không chứa ORM entity hoặc internal domain object.
- Payload chỉ chứa dữ liệu cần cho consumer.

---

## 12. Outbox / Inbox Contract

Outbox dùng để đảm bảo state change và event publish được ghi trong cùng transaction.

```tsx
interface OutboxMessage {
  id: ID
  tenantId: ID
  eventId: ID
  eventName: string
  aggregateId: ID
  aggregateType: string
  payload: unknown
  status: "pending" | "published" | "failed"
  retryCount: number
  occurredAt: Date
  publishedAt?: Date
  lastError?: string
}

interface InboxMessage {
  id: ID
  tenantId: ID
  eventId: ID
  consumerName: string
  status: "processing" | "processed" | "failed"
  processedAt?: Date
  retryCount: number
  lastError?: string
}
```

Quy tắc:

- Command handler ghi aggregate change và outbox message trong cùng transaction.
- Worker publish pending outbox message ra internal event bus hoặc broker.
- Consumer ghi inbox message để chống xử lý duplicate event.
- Mỗi consumer phải idempotent theo `eventId + consumerName`.
- Failed message phải có retry policy và DLQ strategy.

---

## 13. Internal Event Bus Rule

Trong Modular Monolith, event bus có thể là in-process event dispatcher ở giai đoạn MVP.

Tuy nhiên contract phải được thiết kế như thể sau này có thể thay bằng message broker.

Quy tắc:

- Producer không gọi trực tiếp consumer.
- Producer chỉ publish event.
- Consumer subscribe event theo eventName.
- Consumer phải idempotent.
- Không phụ thuộc thứ tự xử lý tuyệt đối giữa nhiều consumer.
- Event handler không được mutate aggregate của context khác trực tiếp.

Allowed flow:

```
OrderCreated
→ Inventory handler consumes event
→ InventoryReserved
```

Disallowed flow:

```
OrderService directly calls InventoryRepository
```

---

## 14. Retry / DLQ Convention

Retry dùng cho lỗi tạm thời.

DLQ dùng cho message không thể xử lý sau số lần retry tối đa.

```tsx
interface RetryPolicy {
  maxAttempts: number
  initialDelayMs: number
  backoffMultiplier: number
  maxDelayMs: number
}
```

Default policy cho MVP:

```
maxAttempts = 5
initialDelayMs = 1000
backoffMultiplier = 2
maxDelayMs = 60000
```

Quy tắc:

- Không retry vô hạn.
- Business validation error không nên retry.
- Infrastructure error có thể retry.
- DLQ message phải lưu reason, retryCount, lastError và original event payload.
- DLQ cần có manual replay strategy.

---

## 15. Event Naming and Versioning

Event name dùng Past Tense.

Đúng:

```
OrderCreated
PaymentSucceeded
InventoryReserved
ShipmentDelivered
```

Sai:

```
CreateOrder
DoPayment
ReserveInventory
```

Versioning rule:

- Event bắt đầu với `eventVersion = 1`.
- Không đổi nghĩa field cũ.
- Không xóa field cũ khi còn consumer dùng.
- Thêm field optional là compatible change.
- Breaking change phải tạo version mới.

Event payload là integration contract, không phải internal model dump.

---

## 16. Event Evolution Rule

Event schema sẽ thay đổi theo thời gian, nên phải có rule evolution rõ ràng.

Compatible changes:

- Add optional field.
- Add new event type.
- Add new enum value nếu consumer ignore unknown value được.
- Add metadata field trong envelope mà consumer không bắt buộc đọc.

Breaking changes:

- Remove field.
- Rename field.
- Change field type.
- Change semantic meaning of existing field.
- Make optional field required.

Quy tắc:

- Breaking change phải tạo eventVersion mới.
- Consumer phải khai báo version mà nó support.
- Producer không xóa event version cũ nếu vẫn còn consumer dùng.
- Event migration phải có phase chuyển tiếp.

---

## 17. Observability Contract

Mọi module phải emit log, metric và trace theo cùng convention.

Minimum metadata bắt buộc:

```
tenantId
correlationId
requestId
moduleName
operationName
```

Đối với event handler, thêm:

```
eventId
eventName
consumerName
retryCount
```

Quy tắc:

- Không log password, token, refresh token hoặc payment secret.
- Không log toàn bộ payload nếu payload chứa dữ liệu nhạy cảm.
- Error log phải có error code và correlationId.
- Business event log và infrastructure log nên phân biệt rõ.

---

## 18. Health Check Contract

MVP backend nên có các health endpoint:

```
GET /health/live
GET /health/ready
```

Liveness check:

- Process còn sống.
- Không kiểm tra dependency nặng.

Readiness check:

- Database connection.
- Outbox worker status nếu có.
- Event dispatcher status nếu có.
- External provider critical dependency nếu request path cần nó.

Quy tắc:

- Liveness fail thì restart process.
- Readiness fail thì ngừng nhận traffic mới.
- Không dùng health endpoint để chạy query business nặng.

---

## 19. Deployment Architecture

Hệ thống được triển khai ban đầu như một Modular Monolith.

```
One backend deployable
Multiple bounded context modules
One primary database deployment
Context-owned tables or schemas
Internal event bus
Outbox worker
Background workers inside same deployable or separate worker process
```

Mục tiêu:

- Giữ domain boundary rõ.
- Giữ deployment đơn giản.
- Giảm distributed-system overhead ở giai đoạn MVP.
- Chuẩn bị sẵn đường extract microservice sau này.

Không triển khai microservice riêng ngay từ đầu.

---

## 20. Module Structure Convention

Gợi ý monorepo/module structure:

```
src/
  shared-kernel/
  modules/
    user/
      domain/
      application/
      infrastructure/
      presentation/
    catalog/
      domain/
      application/
      infrastructure/
      presentation/
    cart/
    pricing/
    inventory/
    order/
    payment/
    shipping/
  workers/
    outbox-worker/
    inbox-cleanup-worker/
  bootstrap/
```

Quy tắc:

- Module không import infrastructure của module khác.
- Presentation layer gọi application layer.
- Application layer gọi domain và port/interface.
- Infrastructure implement repository/gateway interface.
- Shared Kernel chỉ chứa contract thật sự dùng chung.

---

## 21. Microservice Extraction Criteria

Chỉ extract một bounded context thành microservice khi có lý do rõ ràng:

- Team ownership riêng.
- Deployment lifecycle riêng.
- Scaling requirement riêng.
- Database contention rõ.
- Domain boundary đã ổn định.
- Integration event contract đã mature.
- Observability, tracing, retry, DLQ đã sẵn sàng.

Không extract vì:

- Nghe microservice sang.
- Muốn CV đẹp.
- CRUD hơi dài.
- Thấy Netflix làm.
- Muốn Docker Compose nhìn hoành tráng.

Rule chính:

```
Microservice extraction is a consequence, not a starting point.
```

---

## 22. Background Worker Strategy

Background worker xử lý các tác vụ không nên chạy trực tiếp trong HTTP request lifecycle.

Worker chính trong MVP:

```
OutboxWorker
InboxCleanupWorker
ExpiredReservationWorker
PaymentReconciliationWorker
SessionCleanupWorker
```

Quy tắc:

- Worker phải idempotent.
- Worker phải có retry policy rõ ràng.
- Worker log theo correlationId nếu xử lý event.
- Worker không được bypass application use case.
- Worker phải dùng cùng domain/application contract như HTTP layer.

Ví dụ đúng:

```
OutboxWorker publishes pending OutboxMessage
PaymentReconciliationWorker calls ReconcilePayment use case
ExpiredReservationWorker calls ExpireReservation use case
```

Ví dụ sai:

```
Worker directly updates inventory table
Worker directly changes order status without aggregate behavior
```

---

## 23. Scheduler / Cron Convention

Scheduler dùng cho tác vụ định kỳ.

Tác vụ định kỳ gợi ý:

```
expire inventory reservations
clean expired sessions
retry failed outbox messages
reconcile pending payments
archive old inbox records
```

Quy tắc:

- Cron job phải có lock để tránh chạy song song nhiều instance.
- Cron job phải idempotent.
- Cron job phải ghi log start/end/error.
- Không chạy business mutation lớn trong một transaction quá dài.
- Nếu xử lý nhiều record, dùng batch size.

---

## 24. Environment Configuration Strategy

Configuration phải tách khỏi source code.

Nhóm config chính:

```
APP_ENV
DATABASE_URL
JWT_SECRET
REFRESH_TOKEN_SECRET
PAYMENT_PROVIDER_SECRET
EVENT_BUS_MODE
OUTBOX_WORKER_ENABLED
LOG_LEVEL
```

Quy tắc:

- Không commit secret vào repository.
- Không hardcode environment-specific value trong source code.
- Config phải validate khi application bootstrap.
- Missing required config phải fail fast.
- Local development dùng `.env.local` hoặc secret manager local.

---

## 25. Secrets Management Rule

Secret không được log, không được trả về API response và không được lưu plaintext nếu có thể hash.

Secret examples:

```
JWT secret
refresh token
payment webhook secret
database password
provider access token
```

Quy tắc:

- Refresh token lưu dạng hash.
- Webhook secret chỉ dùng để verify signature.
- Log phải redact secret.
- Secret rotation nên được chuẩn bị trong config design.
- Production secret nên lấy từ secret manager hoặc environment injection.

---

## 33. Future Microservice Extraction Plan

Khi cần extract microservice, đi theo thứ tự an toàn:

```
1. Stabilize bounded context boundary
2. Make all cross-context calls go through interface/event
3. Ensure context owns its tables/schema
4. Add contract tests for events/API
5. Add observability for context operations
6. Extract worker/event consumer first if useful
7. Extract database access boundary
8. Deploy as separate service
9. Route traffic gradually
10. Remove in-process implementation after stable period
```

Candidate contexts có thể extract sau:

```
Payment
Shipping
Inventory
Search/Recommendation future context
```

Không nên extract:

```
Shared Kernel
Value objects
Generic utilities
```

Rule chính:

```
Extract behavior and ownership, not files.
```

---

## 26. CI/CD Strategy

MVP CI/CD nên giữ đơn giản nhưng bắt buộc có quality gate.

Pipeline tối thiểu:

```
install dependencies
run lint
run typecheck
run unit tests
run integration tests for critical modules
build application
run database migration check
build container image
```

Quy tắc:

- Không deploy nếu test critical flow fail.
- Migration phải được review trước khi chạy production.
- Build artifact phải immutable.
- Mỗi release phải trace được commit SHA.
- Environment config không nằm trong artifact.

---

## 27. Infrastructure Topology

MVP topology đề xuất:

```
API Process
Worker Process
PostgreSQL Database
Redis optional for lock/cache/session helper
Object Storage for media
External Payment Provider
External Shipping Provider
```

Giai đoạn đầu có thể chạy API và Worker trong cùng deployable nhưng nên tách runtime mode.

Ví dụ:

```
APP_MODE=api
APP_MODE=worker
```

Quy tắc:

- API process xử lý HTTP request.
- Worker process xử lý outbox, retry, cleanup, reconciliation.
- Database là source of truth.
- Redis không được dùng làm source of truth cho business state.
- Object storage chứa media, database chỉ lưu metadata/reference.

---

## 28. Local Development Strategy

Local development phải dễ chạy nhưng không phá production assumption.

Local stack gợi ý:

```
backend app
postgres
redis optional
local object storage emulator optional
mock payment provider
mock shipping provider
```

Quy tắc:

- Local seed data phải deterministic.
- Local event bus có thể dùng in-memory dispatcher.
- Local outbox worker vẫn nên chạy để test event flow.
- Payment/shipping external provider nên mock bằng adapter.
- Không hardcode local-only behavior trong domain logic.

---

## 29. Testing Strategy

Testing pyramid đề xuất:

```
Unit tests: domain behavior and value objects
Application tests: use case orchestration
Integration tests: repository, transaction, outbox/inbox
Contract tests: event payload and API DTO
E2E tests: critical checkout flow only
```

Critical flows bắt buộc test:

```
register/login
add to cart
checkout cart
create order
reserve inventory
confirm payment
create shipment
COD collection
refund flow
```

Quy tắc:

- Domain tests không phụ thuộc database.
- Application tests có thể mock repository port.
- Integration tests dùng database thật hoặc test container.
- E2E test ít nhưng chất lượng cao.
- Flaky test phải được sửa, không được ignore để sống chung như nấm mốc.

---

## 30. Data Migration Strategy

Migration phải được xem là một phần của delivery process, không phải việc phụ “chạy tay chắc được”.

Quy tắc:

- Migration phải được version control.
- Migration phải chạy được nhiều môi trường.
- Migration production cần được review trước khi chạy.
- Migration phá dữ liệu phải có backup/rollback plan.
- Không sửa trực tiếp schema production bằng tay nếu không có incident procedure.

### Safe Migration Pattern

Với thay đổi breaking, dùng expand-and-contract:

```
1. Add new column/table
2. Write both old and new fields if needed
3. Backfill data
4. Switch read path
5. Stop writing old field
6. Remove old field in later release
```

Không nên:

```
rename/drop column production trong cùng release đang dùng field đó
```

---

## 31. API Versioning Strategy

MVP có thể bắt đầu với `/api/v1`.

```
/api/v1/users
/api/v1/products
/api/v1/orders
```

Quy tắc:

- Không breaking response shape trong cùng version.
- Add optional response field là compatible.
- Remove/rename/change type field là breaking.
- Breaking public API phải có version mới hoặc migration window.
- Internal module interface cũng cần changelog nếu có consumer khác.

API error format dùng chung `ApiErrorResponse` từ Shared Kernel.

---

## 32. Frontend Integration Contract

Frontend không nên phụ thuộc trực tiếp vào domain entity.

Presentation layer trả DTO riêng cho từng use case.

Quy tắc:

- API response không expose ORM model.
- API response không expose internal aggregate đầy đủ nếu FE không cần.
- Date trả về ISO string.
- Money amount dùng number ở MVP, có thể nâng cấp Money value object sau.
- Error handling dựa trên `error.code`, không parse message.
- Pagination response dùng PageResponse.

Ví dụ response:

```tsx
interface ProductCardResponse {
  productId: string
  name: string
  primaryImage?: string
  finalPrice?: number
  status: "published"
}
```

Frontend contract phải ổn định hơn internal model.

---

## 30. Security Baseline

Security baseline là tập luật tối thiểu phải có ngay cả ở MVP.

### Authentication

- Password phải hash bằng thuật toán phù hợp như bcrypt hoặc argon2.
- Refresh token phải lưu dạng hash.
- Access token phải có expiration ngắn.
- Refresh token phải có rotation strategy.
- Logout phải revoke session hiện tại.

### Authorization / Tenant Safety

- Mọi request tenant-scoped phải có TenantContext.
- Không lấy tenantId từ request body.
- Repository query phải filter theo tenantId.
- Admin operation phải có use case rõ ràng, không bypass tenant isolation ngầm.

### Input Validation

- Validate request DTO ở presentation layer.
- Validate business invariant ở domain/application layer.
- Không tin dữ liệu từ FE.
- Không expose internal error stack ra API response.

### Sensitive Data

Không log:

```
password
passwordHash
accessToken
refreshToken
payment secret
webhook signature
provider access token
```

### Webhook Security

- Payment webhook phải verify signature.
- Shipping webhook nên verify provider signature nếu provider hỗ trợ.
- Webhook handler phải idempotent.
- Webhook payload nên lưu raw body hoặc audit reference nếu cần reconciliation.

---

## 31. Performance Baseline

Performance baseline dùng để tránh các lỗi hiệu năng cơ bản ngay từ đầu.

### Query Rules

- Không trả unbounded list.
- API list phải có pagination.
- Query theo tenantId phải có index phù hợp.
- Query theo business reference phổ biến phải có index.

Index gợi ý:

```
tenantId + id
tenantId + email
tenantId + productId
tenantId + orderId
tenantId + cartId
tenantId + eventId
tenantId + status
```

### N+1 Prevention

- Query read model nên thiết kế rõ.
- Không để presentation layer trigger lazy loading không kiểm soát.
- Repository trả aggregate đúng nhu cầu use case.

### Large Payload Control

- Product media chỉ trả metadata/reference.
- Event payload chỉ chứa dữ liệu consumer cần.
- API response không dump aggregate toàn bộ nếu FE không cần.

### Worker Performance

- Worker xử lý theo batch size.
- Worker phải có backoff khi dependency lỗi.
- Worker không giữ transaction quá dài.
- Outbox polling phải có limit và ordering rõ ràng.

---

## 30. Implementation Roadmap

Roadmap triển khai nên đi theo hướng vertical slice, không code toàn bộ database trước rồi mới ghép flow sau.

### Phase 1: Foundation

```
Shared Kernel
TenantContext
RequestContext
DomainException
ApiErrorResponse
BaseEntity
Clock
IdempotencyRecord
OutboxMessage
InboxMessage
```

Mục tiêu:

- Có nền kỹ thuật chung.
- Có convention lỗi, event, tenant, tracing.
- Có module structure rõ.

### Phase 2: User + Catalog

```
Register/Login
UserProfile
Product Catalog CRUD
Product publish/archive
```

Mục tiêu:

- Có user đăng nhập.
- Có product public để storefront/cart dùng.

### Phase 3: Cart + Pricing

```
Cart
CartItem
Voucher validation
Product discount
Pricing snapshot
```

Mục tiêu:

- Customer có thể add to cart.
- Cart có thể tính giá snapshot.

### Phase 4: Inventory + Order

```
Inventory reservation
Order creation
Order lifecycle
Outbox events
```

Mục tiêu:

- Checkout tạo order.
- Inventory chống oversell.
- Order dùng event flow.

### Phase 5: Payment + Shipping

```
Invoice generation
Payment webhook
COD confirmation
Shipment lifecycle
Refund flow
```

Mục tiêu:

- Hoàn chỉnh checkout lifecycle.
- Có payment/shipping state thật.

### Phase 6: Hardening

```
Retry policy
DLQ
Observability
E2E critical flow
Security baseline
Performance baseline
```

Mục tiêu:

- Hệ thống đủ ổn để demo production-like.

---

## 31. Technical Debt Strategy

Không phải technical debt nào cũng xấu. Debt xấu là debt không được ghi lại, không có owner và không có thời điểm trả.

Mỗi technical debt nên ghi:

```
Debt title
Context affected
Reason accepted
Risk
Owner
Payback trigger
```

Ví dụ acceptable debt cho MVP:

```
Use in-memory event bus before real broker
Use page/limit pagination before cursor pagination
Use simple promotion rule before full promotion engine
Use single database deployment before separate service database
```

Không nên chấp nhận:

```
No tenant isolation check
No idempotency for payment webhook
No outbox for order/payment event
Plaintext refresh token
Direct cross-context repository call
```

Rule chính:

```
Temporary shortcut must not violate core architecture boundary.
```

---

## 32. Analytics / Tracking Convention

Analytics event khác IntegrationEvent.

IntegrationEvent dùng để điều phối business workflow giữa bounded contexts.

Analytics event dùng để đo hành vi user, funnel và business metric.

Quy tắc:

- Không dùng analytics event để trigger business workflow.
- Không dùng IntegrationEvent thô làm analytics event nếu payload chứa dữ liệu nhạy cảm.
- Analytics event nên được map từ domain/integration event hoặc presentation action.
- Analytics payload phải tối thiểu và không chứa secret.

Ví dụ analytics event:

```
ProductViewed
ProductAddedToCart
CartCheckedOut
PaymentCompleted
OrderCompleted
```

---

## 33. Audit Log Strategy

Audit log dùng để theo dõi hành động quan trọng có tác động tới business/security.

Audit nên ghi cho:

```
login
logout
password changed
voucher created/expired
stock adjusted
order cancelled
refund requested
payment webhook processed
shipment status manually updated
```

Audit record tối thiểu:

```tsx
interface AuditLogRecord {
  id: ID
  tenantId: ID
  actorId?: ID
  action: string
  targetType: string
  targetId: ID
  metadata?: Record<string, unknown>
  correlationId: ID
  occurredAt: Date
}
```

Quy tắc:

- Audit log không thay thế business event.
- Audit log không chứa secret.
- Manual admin action phải có audit log.
- Audit log nên append-only.

---

## 34. Admin / Backoffice Convention

Admin/backoffice action phải đi qua use case riêng, không bypass domain rule.

Quy tắc:

- Admin API không được update database trực tiếp.
- Admin action phải validate tenant scope.
- Admin action quan trọng phải ghi audit log.
- Admin override phải có reason.
- Admin API nên tách route prefix rõ ràng.

Route prefix gợi ý:

```
/api/v1/admin/catalogs
/api/v1/admin/products
/api/v1/admin/inventory
/api/v1/admin/vouchers
/api/v1/admin/orders
/api/v1/admin/shipments
```

---

## 35. MVP Scope Freeze

MVP không cố làm mọi thứ.

Trong scope MVP:

```
User register/login
Product catalog
Cart
Voucher basic
Inventory reservation
Order checkout
Invoice/payment basic
COD/basic shipping
Outbox/inbox foundation
Tenant isolation basic
```

Ngoài scope MVP:

```
Full IAM/RBAC/ABAC
Advanced promotion engine
Recommendation engine
Loyalty program
Multi-warehouse optimization
Partial shipment
Partial refund advanced flow
Full accounting integration
Marketplace multi-seller model
```

Rule chính:

```
MVP must prove core checkout flow before advanced features.
```

---

## 36. Development Principles

Các nguyên tắc phát triển phải được giữ xuyên suốt implementation.

### Principle 1: Domain first, framework second

Business rule nằm trong domain/application layer, không nằm trong controller hoặc ORM hook.

### Principle 2: Boundary before optimization

Giữ boundary giữa bounded contexts trước khi tối ưu performance hoặc reuse code.

### Principle 3: Explicit over implicit

Use case, event, exception, transaction boundary phải được định nghĩa rõ.

### Principle 4: Idempotency by default for async flow

Event handler, webhook handler và worker phải được thiết kế như thể chúng có thể chạy nhiều lần.

### Principle 5: Tenant safety is non-negotiable

Mọi read/write tenant-scoped phải đi qua TenantContext và filter tenantId.

### Principle 6: Shortcut must not break architecture boundary

Có thể đơn giản hóa implementation, nhưng không được phá boundary cốt lõi.

---

## 37. Engineering Checklist Before Coding

Trước khi implement một use case, phải trả lời được:

```
Bounded context nào sở hữu use case này?
Aggregate nào là transaction boundary?
Input DTO gồm field nào required/optional?
Business validation nằm ở đâu?
Use case có cần TenantContext không?
Use case có cần idempotency không?
Use case có emit event không?
Event payload gồm field nào?
Repository port nào cần định nghĩa?
Failure cases/error code là gì?
Test checklist gồm những case nào?
```

Nếu không trả lời được, chưa nên code.

Viết code khi boundary chưa rõ chỉ là cách nhanh hơn để tạo legacy.

---

## 38. Final Architecture Summary

Hệ thống Pet E-commerce được thiết kế theo hướng:

```
Modular Monolith first
DDD Bounded Contexts
Event-Driven internal communication
Transactional Outbox / Inbox
Tenant-aware SaaS foundation
Microservice-ready future extraction
```

Bounded contexts chính:

```
User
Product Catalog
Cart
Pricing & Promotion
Inventory
Order
Payment / Invoice
Shipping
```

Runtime ban đầu:

```
API process
Worker process
PostgreSQL
Optional Redis
Object Storage
External Payment Provider
External Shipping Provider
```

Architecture goal:

```
Build simple enough to ship
Structured enough to evolve
Strict enough to avoid big ball of mud
```

Không build microservice ngay từ đầu.

Microservice chỉ là kết quả của boundary trưởng thành, không phải điểm xuất phát.

---

## 39. Suggested Tech Stack

Tech stack nên phục vụ architecture, không phải ngược lại.

Gợi ý cho MVP backend:

```
Language: TypeScript
Runtime: Node.js
Framework: NestJS hoặc Fastify
Database: PostgreSQL
ORM/Query: Prisma hoặc Drizzle
Cache/Lock optional: Redis
Event mode MVP: In-process event bus + outbox table
Future broker: RabbitMQ / Kafka / NATS tùy nhu cầu
Object storage: S3-compatible storage
Testing: Vitest/Jest + Testcontainers optional
Container: Docker
```

Rule chọn tech:

- Ưu tiên tech quen thuộc để ship nhanh.
- Không chọn broker phức tạp khi in-process event bus + outbox đã đủ MVP.
- Không để ORM model leak ra domain entity.
- Không để framework decorator định nghĩa business rule.

---

## 40. README Bootstrap Structure

README chính của repository nên có cấu trúc tối thiểu:

```
Project Overview
Architecture Decision
Bounded Contexts
Local Development
Environment Variables
Database Migration
Running API
Running Workers
Testing
Event Flow
Deployment Notes
Troubleshooting
```

Ví dụ command section:

```
pnpm install
pnpm dev:api
pnpm dev:worker
pnpm test
pnpm test:integration
pnpm db:migrate
pnpm db:seed
```

README không thay thế architecture document, nhưng phải chỉ đường tới các sub-page liên quan.

---

## 41. Final Coding Start Checklist

Trước khi bắt đầu implementation, phải có:

```
[ ] Module folder structure created
[ ] Shared Kernel base types created
[ ] TenantContext middleware designed
[ ] RequestContext / correlationId middleware designed
[ ] DomainException + ApiErrorResponse implemented
[ ] Clock abstraction implemented
[ ] Outbox / Inbox tables designed
[ ] IdempotencyRecord table designed
[ ] First vertical slice selected
[ ] Local development stack documented
```

First vertical slice khuyến nghị:

```
Register/Login
Create Product
Publish Product
Add Product to Cart
Checkout Cart
Create Order
Reserve Inventory
```

Không bắt đầu bằng full schema toàn hệ thống.

Bắt đầu bằng một flow nhỏ chạy được từ API tới database tới event.

---

## 42. Closing Note

Tài liệu này không nhằm làm hệ thống phức tạp hơn.

Mục tiêu là làm complexity hiện rõ, đặt đúng chỗ và không để nó rò rỉ lung tung.

```
Simple implementation
Strict boundaries
Explicit contracts
Evolution-ready architecture
```

Nếu một quyết định mới làm boundary mờ đi, hãy dừng lại và viết lại decision trước khi code.