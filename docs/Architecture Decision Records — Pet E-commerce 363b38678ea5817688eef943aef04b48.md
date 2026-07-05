# Architecture Decision Records — Pet E-commerce

Trang này ghi lại các quyết định kiến trúc quan trọng để tránh việc tương lai phải đoán mò vì sao hệ thống được thiết kế như hiện tại.

---

## ADR-001 — Modular Monolith First

### Status

Accepted

### Context

Dự án là pet-project SaaS e-commerce theo DDD và Event-Driven Architecture. Domain boundary còn đang được khám phá, team size nhỏ, chưa có nhu cầu scale từng bounded context độc lập.

### Decision

Triển khai hệ thống ban đầu dưới dạng Modular Monolith.

```
One deployable backend
Multiple bounded context modules
Internal event bus
Outbox/Inbox foundation
Microservice-ready contracts
```

### Consequences

Positive:

- Deploy đơn giản hơn.
- Debug dễ hơn.
- Transaction cục bộ dễ kiểm soát hơn.
- Boundary vẫn rõ nếu giữ module discipline.
- Có đường extract microservice sau.

Negative:

- Cần discipline để tránh big ball of mud.
- Không có runtime isolation giữa modules.
- Scaling ban đầu theo whole backend.

---

## ADR-002 — Event-Driven Internal Communication

### Status

Accepted

### Context

Checkout flow cần nhiều bounded context phối hợp: Cart, Order, Inventory, Payment, Shipping.

### Decision

Các context giao tiếp bằng application interface và integration event. Event bus ban đầu có thể là in-process dispatcher, nhưng contract thiết kế như có thể thay bằng broker sau.

### Consequences

Positive:

- Context coupling thấp hơn direct repository call.
- Dễ extract service sau này.
- Workflow rõ hơn.

Negative:

- Cần idempotency.
- Cần outbox/inbox.
- Debug async flow khó hơn sync call.

---

## ADR-003 — Transactional Outbox / Inbox

### Status

Accepted

### Context

State change và event publish phải nhất quán. Nếu DB commit thành công nhưng event publish fail, workflow bị mất event.

### Decision

Dùng Outbox cho producer và Inbox cho consumer deduplication.

### Consequences

Positive:

- Đảm bảo state change và event được ghi cùng transaction.
- Consumer chống duplicate event.
- Worker có thể retry an toàn.

Negative:

- Cần worker.
- Cần cleanup policy.
- Cần monitoring cho pending/failed message.

---

## ADR-004 — Tenant Isolation by Context

### Status

Accepted

### Context

Dự án định hướng SaaS multi-tenant. Tenant leak là lỗi nghiêm trọng hơn crash thông thường.

### Decision

Mọi aggregate/entity tenant-scoped phải có tenantId. Mọi command/query phải nhận TenantContext. Repository bắt buộc filter theo tenantId.

Không lấy tenantId từ request body.

### Consequences

Positive:

- Giảm rủi ro cross-tenant access.
- Dễ audit.
- Dễ chuẩn bị sharding/partition sau.

Negative:

- Query phải discipline hơn.
- Test phải cover tenant mismatch.

---

## ADR-005 — No Cross-Context Foreign Key in Production Design

### Status

Accepted

### Context

Schema trực quan có thể vẽ FK để dễ hiểu, nhưng production design phải giữ ownership giữa bounded contexts.

### Decision

Không dùng FK xuyên bounded context trong production design.

Cross-context reference dùng business ID như productId, orderId, customerId.

### Consequences

Positive:

- Context ownership rõ.
- Dễ extract service/database sau.
- Không khóa lifecycle giữa contexts.

Negative:

- Cần application-level consistency.
- Cần event/read model để kiểm tra reference.

---

## ADR-006 — Reservation-Based Inventory

### Status

Accepted

### Context

Checkout concurrent có thể gây oversell nếu trừ stock trực tiếp thiếu kiểm soát.

### Decision

Inventory dùng reservation model.

```
available = quantity - reservedQuantity
```

OrderCreated reserve stock. PaymentSucceeded confirm deduction. PaymentFailed/OrderCancelled release reservation.

### Consequences

Positive:

- Chống oversell tốt hơn.
- Hỗ trợ payment async.
- Hỗ trợ saga rollback.

Negative:

- Cần reservation expiration worker.
- Cần concurrency test.
- Cần idempotency theo reservationId.

---

## ADR-007 — Payment and COD Are Separate Lifecycle Concerns

### Status

Accepted

### Context

COD không đồng nghĩa paid cho tới khi carrier thật sự thu tiền.

### Decision

Payment/Invoice Context quản lý invoice/payment state. Shipping Context emit CODCollected khi thu tiền thành công. Payment Context consume CODCollected để confirm COD payment.

### Consequences

Positive:

- Revenue reporting chính xác hơn.
- COD flow rõ hơn.
- Payment và delivery lifecycle không bị trộn.

Negative:

- Cần event coordination.
- Cần reconciliation cho COD edge cases.

---

## ADR-008 — Shared Kernel Must Stay Thin

### Status

Accepted

### Context

Shared folder dễ phình thành nơi chứa mọi thứ, làm boundary mờ dần.

### Decision

Shared Kernel chỉ chứa contract thật sự dùng chung: TenantContext, RequestContext, IntegrationEvent, DomainException, Clock, Idempotency, Outbox/Inbox contract.

Không chứa business rule của bounded context.

### Consequences

Positive:

- Boundary rõ.
- Ownership rõ.
- Dễ maintain.

Negative:

- Có thể duplicate một ít code giữa contexts.
- Cần review khi thêm shared abstraction mới.

---

## ADR-009 — Microservice Extraction Is Future Option

### Status

Accepted

### Context

Microservice từ đầu sẽ tăng complexity khi domain chưa chín.

### Decision

Không triển khai microservice ngay từ đầu. Chỉ extract khi có lý do rõ: ownership, scale, deployment lifecycle, database contention hoặc integration contract đã mature.

### Consequences

Positive:

- Tránh premature distributed system.
- Giữ tốc độ MVP.
- Vẫn có đường extract sau.

Negative:

- Cần discipline để giữ module boundary.
- Cần refactor nếu boundary ban đầu sai.