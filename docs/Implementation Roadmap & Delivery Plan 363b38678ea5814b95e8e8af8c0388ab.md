# Implementation Roadmap & Delivery Plan

Trang con này mô tả kế hoạch triển khai backend cho Pet E-commerce theo hướng Modular Monolith, DDD, Event-Driven internal flow và Microservice-ready.

Mục tiêu của trang này là chuyển architecture blueprint thành thứ có thể code theo từng phase, thay vì ngồi chiêm ngưỡng tài liệu như tượng đá.

---

## 1. Delivery Principle

Triển khai theo vertical slice, không triển khai toàn bộ schema trước.

```
A working thin flow is better than a complete dead schema.
```

Mỗi phase phải tạo ra một luồng chạy được, có test và có event/outbox nếu phase đó liên quan async flow.

---

## 2. Phase 0 — Repository Bootstrap

Mục tiêu: tạo nền repo và runtime tối thiểu.

Tasks:

```
[ ] Initialize backend repository
[ ] Setup TypeScript config
[ ] Setup formatter/linter
[ ] Setup test framework
[ ] Setup module folder convention
[ ] Setup environment config validation
[ ] Setup PostgreSQL connection
[ ] Setup migration tool
[ ] Setup Docker compose for local development
```

Definition of Done:

```
[ ] App boots locally
[ ] Database connects locally
[ ] Health endpoint works
[ ] Unit test command works
[ ] Migration command works
```

---

## 3. Phase 1 — Shared Kernel Foundation

Mục tiêu: tạo contract nền dùng chung.

Tasks:

```
[ ] Implement ID type convention
[ ] Implement BaseEntity / TenantScoped interfaces
[ ] Implement DomainException
[ ] Implement ApiErrorResponse mapping
[ ] Implement TenantContext
[ ] Implement RequestContext
[ ] Implement correlationId middleware
[ ] Implement Clock interface
[ ] Implement FakeClock for tests
[ ] Design idempotency_records table
[ ] Design outbox_messages table
[ ] Design inbox_messages table
```

Definition of Done:

```
[ ] Every request has requestId and correlationId
[ ] DomainException maps to stable API error response
[ ] TenantContext can be resolved in application layer
[ ] Outbox table migration exists
[ ] Idempotency table migration exists
```

---

## 4. Phase 2 — User + Catalog Slice

Mục tiêu: có user đăng nhập và product publish được.

Tasks:

```
[ ] Implement RegisterUser
[ ] Implement Login
[ ] Implement RefreshToken
[ ] Implement ChangePassword
[ ] Implement UserProfile query
[ ] Implement CreateCatalog
[ ] Implement CreateProduct
[ ] Implement PublishProduct
[ ] Implement ProductPublished event
```

Definition of Done:

```
[ ] User can register/login
[ ] Refresh token rotation works
[ ] Product starts as draft
[ ] Product can be published
[ ] ProductPublished event is written to outbox
[ ] Tenant isolation tests pass
```

---

## 5. Phase 3 — Cart + Pricing Slice

Mục tiêu: customer có thể thêm hàng vào cart và nhận pricing snapshot.

Tasks:

```
[ ] Implement CreateCart
[ ] Implement AddCartItem
[ ] Implement UpdateCartItemQuantity
[ ] Implement RemoveCartItem
[ ] Implement ValidateVoucher
[ ] Implement CalculateProductPrice
[ ] Implement PricingSnapshot
[ ] Implement CartCheckedOut draft flow
```

Definition of Done:

```
[ ] Cart item stores price snapshot
[ ] Voucher validation works
[ ] Product discount applies before voucher
[ ] Cart total is deterministic
[ ] Pricing errors use stable error codes
```

---

## 6. Phase 4 — Inventory + Order Slice

Mục tiêu: checkout tạo order và reserve inventory an toàn.

Tasks:

```
[ ] Implement ProductInventory aggregate
[ ] Implement ReserveInventory
[ ] Implement ReleaseInventory
[ ] Implement ConfirmInventoryDeduction
[ ] Implement CreateOrderFromCartCheckedOut
[ ] Implement OrderCreated event
[ ] Implement InventoryReserved event
[ ] Implement checkout saga state
```

Definition of Done:

```
[ ] Order can be created from cart
[ ] Inventory reservation prevents oversell
[ ] Duplicate reservation does not reserve twice
[ ] Failed reservation can cancel order
[ ] Events are persisted to outbox
[ ] Critical concurrency test exists
```

---

## 7. Phase 5 — Payment + Shipping Slice

Mục tiêu: hoàn chỉnh checkout lifecycle.

Tasks:

```
[ ] Implement GenerateInvoice
[ ] Implement ConfirmPayment webhook
[ ] Implement HandlePaymentFailed
[ ] Implement RefundPayment basic flow
[ ] Implement CreateShipment
[ ] Implement UpdateShipmentStatus
[ ] Implement ConfirmCODCollected
[ ] Implement PaymentSucceeded event
[ ] Implement ShipmentCreated event
[ ] Implement CODCollected event
```

Definition of Done:

```
[ ] Invoice generated from order
[ ] Payment webhook is idempotent
[ ] PaymentSucceeded triggers inventory deduction
[ ] Shipment can be created
[ ] COD collection confirms payment for COD order
[ ] Refund basic flow works
```

---

## 8. Phase 6 — Hardening

Mục tiêu: hệ thống đủ chắc để demo production-like.

Tasks:

```
[ ] Add retry policy for outbox worker
[ ] Add DLQ table or failed message state
[ ] Add worker metrics/logging
[ ] Add audit log for admin actions
[ ] Add security baseline tests
[ ] Add E2E checkout happy path
[ ] Add E2E payment failed path
[ ] Add E2E COD path
[ ] Add migration review checklist
```

Definition of Done:

```
[ ] Failed event can be retried
[ ] Duplicate event is ignored by inbox
[ ] Critical flows have E2E tests
[ ] Logs include tenantId and correlationId
[ ] No secret is logged
```

---

## 9. Do Not Build Yet

Không triển khai trong MVP:

```
Full RBAC/ABAC
Advanced promotion engine
Recommendation engine
Loyalty program
Partial shipment
Partial refund advanced flow
Marketplace multi-seller model
Full accounting integration
Kafka cluster
Kubernetes deployment
```

Rule:

```
If core checkout flow is not stable, advanced feature is a distraction.
```

---

## 10. First Vertical Slice Recommendation

Vertical slice đầu tiên nên là:

```
Register/Login
→ Create Product
→ Publish Product
→ Create Cart
→ Add Cart Item
→ Checkout Cart
→ Create Order
→ Reserve Inventory
```

Lý do:

- Chạm User, Catalog, Cart, Order, Inventory.
- Test được TenantContext.
- Test được Outbox.
- Test được event flow.
- Chưa cần external payment/shipping provider.

Đây là slice đủ nhỏ để làm được, nhưng đủ sâu để lộ architecture bug.