# Engineering Task Backlog — Pet E-commerce

Trang này chuyển roadmap thành backlog kỹ thuật có thể triển khai theo từng nhóm việc.

---

## 1. Foundation Backlog

```
[ ] Initialize repository
[ ] Setup TypeScript
[ ] Setup framework bootstrap
[ ] Setup formatter and linter
[ ] Setup testing framework
[ ] Setup environment config validation
[ ] Setup database connection
[ ] Setup migration tool
[ ] Setup Docker Compose for local development
[ ] Add /health/live endpoint
[ ] Add /health/ready endpoint
```

---

## 2. Shared Kernel Backlog

```
[ ] Implement ID type convention
[ ] Implement BaseEntity interface
[ ] Implement TenantScoped interface
[ ] Implement DomainException
[ ] Implement ApiErrorResponse mapper
[ ] Implement RequestContext
[ ] Implement TenantContext
[ ] Implement correlationId middleware
[ ] Implement Clock interface
[ ] Implement SystemClock
[ ] Implement FakeClock for tests
[ ] Design idempotency_records table
[ ] Design outbox_messages table
[ ] Design inbox_messages table
[ ] Implement OutboxRepository
[ ] Implement InboxRepository
[ ] Implement internal event dispatcher
```

---

## 3. User Context Backlog

```
[ ] Implement UserProfile entity
[ ] Implement UserIdentity entity
[ ] Implement UserSession entity
[ ] Implement RegisterUser use case
[ ] Implement Login use case
[ ] Implement RefreshToken use case
[ ] Implement ChangePassword use case
[ ] Implement UpdateProfile use case
[ ] Implement UserProfileRepository
[ ] Implement UserIdentityRepository
[ ] Implement UserSessionRepository
[ ] Add auth routes
[ ] Add /me routes
[ ] Add user context tests
```

---

## 4. Product Catalog Backlog

```
[ ] Implement Catalog aggregate
[ ] Implement Product aggregate
[ ] Implement ProductAttribute entity
[ ] Implement ProductMedia entity
[ ] Implement CreateCatalog
[ ] Implement CreateProduct
[ ] Implement PublishProduct
[ ] Implement ArchiveProduct
[ ] Implement CatalogRepository
[ ] Implement ProductRepository
[ ] Add catalog admin APIs
[ ] Add product admin APIs
[ ] Add product public query APIs
[ ] Add ProductPublished outbox event
```

---

## 5. Cart + Pricing Backlog

```
[ ] Implement Cart aggregate
[ ] Implement CartItem entity
[ ] Implement CreateCart
[ ] Implement AddCartItem
[ ] Implement UpdateCartItemQuantity
[ ] Implement RemoveCartItem
[ ] Implement CheckoutCart
[ ] Implement Voucher aggregate
[ ] Implement ProductDiscount aggregate
[ ] Implement ValidateVoucher
[ ] Implement CalculateProductPrice
[ ] Implement CommitVoucherUsage
[ ] Add cart APIs
[ ] Add voucher admin APIs
[ ] Add pricing tests
```

---

## 6. Inventory + Order Backlog

```
[ ] Implement ProductInventory aggregate
[ ] Implement InventoryReservation entity
[ ] Implement ReserveInventory
[ ] Implement ReleaseInventory
[ ] Implement ConfirmInventoryDeduction
[ ] Implement AdjustStock
[ ] Implement Order aggregate
[ ] Implement OrderItem entity
[ ] Implement CreateOrderFromCartCheckedOut
[ ] Implement CancelOrder
[ ] Implement MarkOrderPaid
[ ] Add inventory event handlers
[ ] Add order event handlers
[ ] Add concurrency tests for reservation
```

---

## 7. Payment + Shipping Backlog

```
[ ] Implement Invoice aggregate
[ ] Implement PaymentTransaction entity
[ ] Implement RefundTransaction entity
[ ] Implement GenerateInvoice
[ ] Implement ConfirmPayment webhook
[ ] Implement HandlePaymentFailed
[ ] Implement RefundPayment
[ ] Implement Shipment aggregate
[ ] Implement COD entity
[ ] Implement CreateShipment
[ ] Implement UpdateShipmentStatus
[ ] Implement ConfirmCODCollected
[ ] Add payment webhook idempotency tests
[ ] Add shipping webhook tests
```

---

## 8. Worker Backlog

```
[ ] Implement OutboxWorker
[ ] Implement Inbox duplicate guard
[ ] Implement retry policy
[ ] Implement failed message state
[ ] Implement DLQ/replay strategy
[ ] Implement ExpiredReservationWorker
[ ] Implement SessionCleanupWorker
[ ] Implement PaymentReconciliationWorker
[ ] Add worker metrics/logging
```

---

## 9. E2E Backlog

```
[ ] E2E register/login
[ ] E2E product publish
[ ] E2E add to cart
[ ] E2E checkout happy path
[ ] E2E inventory insufficient stock
[ ] E2E payment success
[ ] E2E payment failed rollback
[ ] E2E COD collection
[ ] E2E refund basic flow
```

---

## 10. Rule

Không kéo task advanced vào backlog MVP nếu core checkout flow chưa chạy ổn.

```
Core checkout flow first.
Everything else later.
```