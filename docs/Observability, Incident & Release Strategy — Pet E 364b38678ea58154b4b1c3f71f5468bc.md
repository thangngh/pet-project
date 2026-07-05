# Observability, Incident & Release Strategy — Pet E-commerce

Trang này mô tả chiến lược quan sát hệ thống, xử lý incident, release/deployment và vận hành production-lite cho Pet E-commerce.

Mục tiêu là giúp hệ thống không chỉ chạy được, mà còn debug được, rollback được và phục hồi được khi đời thật bắt đầu ném lỗi vào mặt ta.

---

## 1. Observability Principles

Observability không phải chỉ là log thật nhiều.

Hệ thống cần tối thiểu ba trụ cột:

```
Logs
Metrics
Traces
```

Nguyên tắc:

- Mọi request phải có `requestId`.
- Mọi business flow phải có `correlationId`.
- Event handler phải log `eventId`, `eventName`, `consumerName`.
- Worker phải log batch size, retry count, failed count.
- Không log secret, token, password, payment secret hoặc raw credential.

Rule:

```
If you cannot trace a checkout from API to worker to event, the system is not observable enough.
```

---

## 2. Logging Convention

Mọi log quan trọng nên có metadata chuẩn:

```
timestamp
level
serviceName
moduleName
operationName
tenantId
requestId
correlationId
causationId optional
userId optional
```

Event handler log thêm:

```
eventId
eventName
eventVersion
consumerName
retryCount
```

Payment/shipping webhook log thêm:

```
provider
providerTransactionId optional
trackingCode optional
signatureValid
idempotencyKey optional
```

Không log:

```
password
passwordHash
accessToken
refreshToken
payment secret
webhook signature raw value
provider access token
full card data
```

Log levels:

```
DEBUG: local/dev diagnostic
INFO: business operation completed
WARN: recoverable abnormal condition
ERROR: failed operation requiring attention
FATAL: process cannot continue safely
```

---

## 3. Metrics Convention

Metrics nên đo cả system health và business flow health.

System metrics:

```
http_request_count
http_request_duration_ms
http_error_count
database_query_duration_ms
worker_job_duration_ms
worker_error_count
outbox_pending_count
outbox_failed_count
inbox_failed_count
```

Business metrics:

```
user_registered_count
cart_checked_out_count
order_created_count
payment_succeeded_count
payment_failed_count
inventory_reservation_failed_count
shipment_delivered_count
refund_requested_count
cod_collected_count
```

Rule:

```
Metrics must distinguish business failure from infrastructure failure.
```

Ví dụ:

```
INSUFFICIENT_STOCK is business failure
DATABASE_TIMEOUT is infrastructure failure
```

---

## 4. Distributed Tracing Strategy

MVP Modular Monolith có thể chưa cần distributed tracing phức tạp, nhưng vẫn phải giữ trace metadata chuẩn.

Trace propagation:

```
HTTP request
→ Application use case
→ Domain operation
→ Outbox message
→ Worker publish
→ Event consumer
→ Downstream use case
```

Bắt buộc truyền:

```
correlationId
causationId
requestId if request-originated
```

Event causation rule:

```
If OrderCreated causes ReserveInventory, then InventoryReserved should have causationId = OrderCreated.eventId.
```

---

## 5. Alerting Strategy

Alert chỉ nên tạo khi cần hành động.

Alert candidates:

```
outbox_failed_count > threshold
outbox_pending_count grows continuously
payment_webhook_failure_rate high
inventory_reservation_failure_rate abnormal
http_5xx_rate high
database_connection_error
worker_not_running
payment_reconciliation_failed
```

Không alert cho mọi WARN log.

Rule:

```
An alert without an action is just anxiety automation.
```

Mỗi alert nên có:

```
alert name
severity
condition
owner
runbook link
expected action
```

---

## 6. Health Check Strategy

Health endpoints:

```
GET /health/live
GET /health/ready
```

Liveness:

- Process còn sống.
- Không kiểm tra dependency nặng.

Readiness:

- Database connection.
- Migration state compatible.
- Worker dependency if process is worker.
- Optional external provider availability if critical path requires it.

Rule:

```
Liveness tells whether to restart. Readiness tells whether to receive traffic.
```

---

## 7. Incident Response Process

Incident là sự kiện ảnh hưởng tới user, data integrity, money flow hoặc security.

Severity levels:

```
SEV1: data leak, payment corruption, system down
SEV2: checkout/payment/shipping major failure
SEV3: degraded feature, limited customer impact
SEV4: minor issue, workaround available
```

Incident checklist:

```
[ ] Identify impact
[ ] Assign incident owner
[ ] Freeze risky deploys
[ ] Capture correlation IDs / affected tenants
[ ] Check recent deployments/migrations
[ ] Check outbox/inbox failed messages
[ ] Check payment/shipping provider status
[ ] Mitigate first
[ ] Root cause later
[ ] Write postmortem
```

Rule:

```
During incident, restore safety first. Elegance can wait.
```

---

## 8. Runbook Templates

### Payment Webhook Failure Runbook

Signals:

```
payment webhook 5xx rate high
PAYMENT_AMOUNT_MISMATCH increased
payment pending count grows
```

Actions:

```
[ ] Verify provider status
[ ] Check webhook signature validation
[ ] Inspect raw webhook payload samples
[ ] Check idempotency records
[ ] Check payment_transactions by providerTransactionId
[ ] Replay safe failed webhook if needed
[ ] Reconcile invoice/payment state
```

### Outbox Backlog Runbook

Signals:

```
outbox_pending_count growing
outbox_failed_count above threshold
worker not publishing
```

Actions:

```
[ ] Check worker process health
[ ] Check database connectivity
[ ] Check last_error on failed outbox messages
[ ] Pause poison message if blocking batch
[ ] Replay retryable messages
[ ] Move non-retryable messages to DLQ/manual review
```

### Inventory Oversell Risk Runbook

Signals:

```
negative available quantity
reservation concurrency failures spike
stock adjustment anomalies
```

Actions:

```
[ ] Stop affected checkout path if needed
[ ] Identify affected productIds
[ ] Check inventory_reservations
[ ] Check order/payment state
[ ] Release invalid reservations
[ ] Audit stock adjustment history
[ ] Add temporary product-level checkout block if needed
```

---

## 9. Release Strategy

MVP release strategy nên đơn giản nhưng có kỷ luật.

Minimum release checklist:

```
[ ] Changelog updated
[ ] Migration reviewed
[ ] Tests pass
[ ] Critical E2E pass
[ ] Config changes documented
[ ] Rollback plan documented
[ ] Monitoring/alerts checked
```

Deployment order example:

```
1. Run backward-compatible migration
2. Deploy application
3. Enable feature flag if needed
4. Monitor metrics/logs
5. Complete cleanup migration later
```

Rule:

```
Never combine risky schema change and risky behavior change without rollback plan.
```

---

## 10. Feature Flag Strategy

Feature flag dùng cho behavior rollout, không dùng để che giấu code bẩn mãi mãi.

Candidates:

```
new checkout flow
new payment provider
new shipping provider
new pricing rule
new admin operation
```

Rules:

- Feature flag phải có owner.
- Feature flag phải có removal date.
- Flag state phải observable.
- Không để stale flag sống vô hạn.

---

## 11. Rollback Strategy

Rollback phải được nghĩ trước khi deploy.

Rollback types:

```
application rollback
feature flag rollback
migration rollback
manual data correction
provider configuration rollback
```

Rules:

- Application rollback chỉ an toàn nếu schema backward-compatible.
- Destructive migration cần backup trước.
- Payment/shipping state correction cần audit log.
- Manual correction phải có incident record.

---

## 12. Postmortem Template

Postmortem không dùng để tìm người đổ lỗi. Dùng để giảm khả năng lỗi lặp lại.

Template:

```
Incident title
Severity
Start time
End time
Affected tenants/users/orders
Impact summary
Timeline
Root cause
Detection gap
Mitigation
What went well
What went poorly
Action items
Owner
Due date
```

Rule:

```
A postmortem without action items is just literature.
```

---

## 13. Final Operational Checklist

Before production-like demo:

```
[ ] Logs include correlationId
[ ] Errors include correlationId
[ ] Outbox worker observable
[ ] Failed event replay path exists
[ ] Payment webhook idempotency tested
[ ] Checkout E2E tested
[ ] Restore procedure documented
[ ] Migration rollback reviewed
[ ] Admin manual actions audited
[ ] No secret in logs
[ ] Health endpoints available
```

Rule:

```
If the system fails, it must fail in a way humans can understand and recover from.
```