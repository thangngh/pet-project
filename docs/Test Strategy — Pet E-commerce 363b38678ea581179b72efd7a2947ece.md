# Test Strategy — Pet E-commerce

Trang này mô tả chiến lược test cho backend Pet E-commerce theo Modular Monolith, DDD và Event-Driven internal flow.

Mục tiêu là xác định test ở tầng nào, test cái gì, dùng loại test nào và flow nào bắt buộc có coverage.

---

## Scope

Bao gồm:

- Testing pyramid
- Unit test strategy
- Application/use case test strategy
- Integration test strategy
- Contract test strategy
- E2E test strategy
- Event-driven test strategy
- Concurrency test strategy
- Security test baseline

---

## 1. Testing Principles

Testing strategy phải phục vụ architecture, không chỉ tăng coverage number cho đẹp dashboard.

Nguyên tắc chính:

- Test business invariant ở domain layer.
- Test orchestration ở application layer.
- Test persistence/transaction ở integration layer.
- Test contract cho API và event payload.
- Test E2E chỉ cho critical business flow.
- Không dùng E2E để thay thế unit/application test.

Rule:

```
Test behavior, not implementation detail.
```

---

## 2. Testing Pyramid

```
Many       Domain Unit Tests
Many       Application Use Case Tests
Some       Integration Tests
Some       Contract Tests
Few        E2E Tests
```

Mục tiêu:

- Domain test nhanh, rẻ, deterministic.
- Application test kiểm tra use case orchestration.
- Integration test kiểm tra database, transaction, outbox/inbox.
- Contract test bảo vệ API/event schema.
- E2E test bảo vệ critical flow từ ngoài vào.

---

## 3. Domain Unit Test Strategy

Domain tests không phụ thuộc:

```
HTTP framework
Database
ORM
Message broker
External provider
```

Nên test:

```
Cart total calculation
Voucher validation rule
Inventory available quantity
Inventory reservation invariant
Order state transition
Payment state transition
Shipment state transition
User password policy
```

Ví dụ test case:

```
ReserveInventory fails when available quantity is not enough
Order cannot move from cancelled to paid
Voucher expired cannot be applied
COD cannot be collected before shipment delivered
```

---

## 4. Application Use Case Test Strategy

Application tests kiểm tra orchestration của use case.

Nên mock:

```
Repository ports
External provider ports
Event publisher port
Clock
Idempotency service
```

Nên test:

```
Input validation path
Domain method invocation
Repository save behavior
Outbox event creation
Idempotency conflict
Permission / tenant mismatch
Failure mapping
```

Ví dụ:

```
CheckoutCart creates order command when cart is valid
ConfirmPayment rejects duplicate providerTransactionId
CommitVoucherUsage does not increase usedCount twice for same orderId
CreateShipment does not create duplicate shipment for same orderId
```

---

## 5. Integration Test Strategy

Integration tests kiểm tra phần tương tác với infrastructure thật.

Nên dùng database thật hoặc test container.

Nên test:

```
Repository query filters tenantId
Transaction rollback
Optimistic locking
Outbox write in same transaction
Inbox duplicate guard
Migration validity
Unique constraints
Indexes for common query path
```

Ví dụ:

```
OrderCreated transaction writes order and outbox message together
Duplicate inbox event is ignored by consumer
Tenant A cannot read Tenant B product
Inventory reservation rollback does not persist partial state
```

---

## 6. Contract Test Strategy

Contract tests bảo vệ API DTO và IntegrationEvent payload khỏi breaking change vô tình.

Nên test:

```
API response shape
API error response shape
Required fields
Optional fields
Event envelope
Event payload version
Backward compatible event changes
```

Rule:

```
If frontend or another context depends on it, it needs a contract test.
```

Không test contract bằng snapshot khổng lồ không kiểm soát. Snapshot lớn thường chỉ là rác JSON có vẻ nghiêm túc.

---

## 7. Event-Driven Test Strategy

Event-driven flow phải test cả producer và consumer.

Producer tests:

```
[ ] Use case writes correct outbox event
[ ] Event envelope has eventId, tenantId, correlationId
[ ] Event payload uses expected version
[ ] Event payload does not expose internal entity
```

Consumer tests:

```
[ ] Consumer handles valid event
[ ] Consumer ignores duplicate event by inbox
[ ] Consumer rejects unsupported event version
[ ] Consumer maps event to correct use case
[ ] Consumer handles missing optional field safely
```

Critical event flows:

```
CartCheckedOut -> OrderCreated
OrderCreated -> InventoryReserved
PaymentSucceeded -> InventoryDeducted
PaymentSucceeded -> ShipmentCreated
CODCollected -> PaymentSucceeded
PaymentFailed -> InventoryReleased
```

---

## 8. Concurrency Test Strategy

Concurrency tests bắt buộc cho các flow có shared mutable state.

Phải test:

```
inventory reservation
voucher usage commit
payment webhook duplicate
refund request duplicate
shipment status update
stock adjustment
```

Ví dụ:

```
Two concurrent ReserveInventory commands must not oversell
Two duplicate ConfirmPayment webhooks must not mark invoice paid twice
Two CommitVoucherUsage commands for same orderId must not increase usedCount twice
```

Test nên dùng database thật nếu invariant phụ thuộc transaction/lock.

---

## 9. E2E Test Strategy

E2E test chỉ cover critical user journey, không cover mọi permutation nhỏ.

Critical E2E flows:

```
Guest registers and logs in
Admin creates and publishes product
Customer adds product to cart
Customer checks out cart
Order reserves inventory
Payment success completes order
Payment failure releases inventory
COD order creates shipment and confirms COD collection
Refund basic flow succeeds
```

Rule:

- E2E test phải ít nhưng ổn định.
- E2E test không thay thế domain/application tests.
- E2E test cần deterministic seed data.
- E2E test phải cleanup data hoặc chạy trong isolated test database.

---

## 10. Security Test Strategy

Security tests kiểm tra các lỗi nền tảng có thể gây leak dữ liệu hoặc bypass auth.

Bắt buộc test:

```
[ ] Request without auth token is rejected
[ ] Invalid token is rejected
[ ] Expired token is rejected
[ ] Blocked user cannot login
[ ] Revoked refresh token cannot be used
[ ] Tenant A cannot access Tenant B data
[ ] Request body tenantId is ignored or rejected
[ ] Password hash is never returned in API response
[ ] Refresh token is never stored plaintext
[ ] Payment webhook with invalid signature is rejected
```

Rule:

```
Tenant leak is a critical security failure, not a normal bug.
```

---

## 11. Performance / Load Test Baseline

MVP không cần load test phức tạp, nhưng cần baseline để phát hiện lỗi thô.

Nên test:

```
Product listing pagination
Product detail read
Add to cart
Checkout cart
Reserve inventory concurrency
Payment webhook burst duplicate
Outbox worker batch publish
```

Metrics cần quan sát:

```
p95 latency
error rate
database query count
slow query count
outbox pending count
worker retry count
```

Rule:

- Không optimize trước khi đo.
- Nhưng không được bỏ qua index obvious theo tenantId + business key.
- Load test nên dùng data gần giống production shape, không dùng 5 rows rồi tự tin như vua.

---

## 12. Flaky Test Policy

Flaky test là technical debt có lãi suất rất cao.

Quy tắc:

- Không ignore flaky test lâu dài.
- Flaky test phải được gắn owner.
- Nếu test flaky do time, dùng FakeClock.
- Nếu flaky do data, isolate database hoặc seed deterministic.
- Nếu flaky do async event, thêm deterministic wait/retry helper có timeout rõ.
- Không dùng sleep cố định vô tội vạ.

Sai:

```
await sleep(5000)
```

Đúng hơn:

```
await waitUntil(() => eventProcessed(eventId), timeoutMs)
```

---

## 13. CI Test Pipeline

Pipeline test tối thiểu:

```
lint
typecheck
unit tests
application tests
integration tests
contract tests
build
```

E2E có thể chạy:

```
on pull request for critical branch
nightly
before release
```

Quality gate:

```
[ ] Lint pass
[ ] Typecheck pass
[ ] Unit tests pass
[ ] Integration tests pass
[ ] Contract tests pass
[ ] Critical E2E pass before release
```

Rule:

```
A red CI is a stop sign, not decoration.
```