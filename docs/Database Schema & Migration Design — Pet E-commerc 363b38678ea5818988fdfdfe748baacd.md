# Database Schema & Migration Design — Pet E-commerce

Trang này mô tả schema design thực tế cho Modular Monolith định hướng Microservice-ready.

Mục tiêu là phân biệt rõ schema trực quan dùng để hiểu domain với schema triển khai thực tế không dùng foreign key xuyên bounded context.

---

## Scope

Bao gồm:

- Schema ownership by bounded context
- Physical database strategy
- Table naming convention
- ID strategy
- Index strategy
- No cross-context FK rule
- Outbox / Inbox / Idempotency schema
- Migration strategy
- Expand-and-contract pattern

---

## 1. Schema Design Principles

Database schema phải phục vụ Modular Monolith định hướng Microservice-ready.

Nguyên tắc:

- Mỗi bounded context sở hữu bảng của chính nó.
- Không dùng foreign key xuyên bounded context trong production design.
- Cross-context reference dùng business ID như `productId`, `orderId`, `customerId`.
- Bảng tenant-scoped phải có `tenant_id`.
- Aggregate root quan trọng phải có `version` để hỗ trợ optimistic locking.
- Schema trực quan có thể vẽ FK để hiểu domain, nhưng schema triển khai phải giữ ownership boundary.

Rule:

```
Database relationship must not destroy domain ownership.
```

---

## 2. Physical Database Strategy

MVP dùng một PostgreSQL deployment duy nhất.

Có thể tổ chức theo một trong hai hướng:

### Option A: Shared database, context-owned tables

```
users
user_identities
products
product_attributes
cart_items
orders
order_items
outbox_messages
```

Ưu điểm:

- Dễ triển khai.
- Dễ migrate.
- Dễ query trong giai đoạn MVP.

Nhược điểm:

- Cần discipline để không query trực tiếp bảng context khác.

### Option B: Shared database, schema per context

```
user.users
catalog.products
cart.carts
inventory.product_inventory
order.orders
payment.invoices
shipping.shipments
```

Ưu điểm:

- Ownership rõ hơn.
- Chuẩn bị tốt hơn cho service extraction.

Nhược điểm:

- Migration setup phức tạp hơn.
- Naming dài hơn.

MVP khuyến nghị:

```
Shared database + context-owned tables
```

Có thể nâng lên schema-per-context sau nếu project lớn hơn.

---

## 3. No Cross-Context FK Rule

Không tạo foreign key xuyên bounded context.

Ví dụ không dùng:

```
orders.customer_id -> users.id
order_items.product_id -> products.id
shipments.order_id -> orders.id
invoices.order_id -> orders.id
```

Thay vào đó:

```
orders.customer_id is business reference
order_items.product_id is product snapshot reference
shipments.order_id is order reference
invoices.order_id is order reference
```

Trong cùng bounded context vẫn có thể dùng FK nội bộ.

Ví dụ được phép:

```
order_items.order_id -> orders.id
product_media.product_id -> products.id
cart_items.cart_id -> carts.id
payment_transactions.invoice_id -> invoices.id
```

Rule:

```
Foreign key is allowed inside a bounded context, not across bounded contexts.
```

---

## 4. Table Naming Convention

Tên bảng dùng snake_case, số nhiều hoặc domain term rõ nghĩa.

Gợi ý:

```
users
user_identities
user_sessions
catalogs
products
product_attributes
product_media
carts
cart_items
orders
order_items
product_inventory
inventory_reservations
invoices
payment_transactions
refund_transactions
shipments
shipment_tracking_events
cod_records
outbox_messages
inbox_messages
idempotency_records
```

Quy tắc:

- Không dùng tên quá generic như `items`, `logs`, `details` nếu không có context rõ.
- Table name nên phản ánh ownership context.
- Nếu dùng schema-per-context, không cần prefix context quá dài trong tên bảng.

---

## 5. ID Strategy

MVP dùng string ID, ưu tiên UUID/ULID.

```
id varchar primary key
```

Gợi ý:

- UUID tốt cho tính phổ biến.
- ULID tốt nếu muốn sortable ID theo thời gian.
- Không dùng auto-increment integer nếu có kế hoạch extract service sau này.

Business code có thể tách riêng khỏi technical ID.

Ví dụ:

```
orders.id = internal technical ID
orders.order_code = customer-facing order code
```

Rule:

```
Public code is not always primary key.
```

---

## 6. Common Columns

Aggregate root tables nên có:

```
id
tenant_id
created_at
updated_at
version
```

Optional columns tùy lifecycle:

```
status
archived_at
deleted_at
created_by
updated_by
```

Quy tắc:

- `tenant_id` bắt buộc cho tenant-scoped table.
- `version` dùng cho optimistic locking.
- `created_at` và `updated_at` dùng timestamp with timezone nếu database hỗ trợ.
- Soft delete chỉ dùng khi business cần restore/audit, không dùng như phản xạ vô điều kiện.

---

## 7. Index Strategy

Index phải theo query pattern thật.

Index tối thiểu cho SaaS:

```
tenant_id + id
tenant_id + status
tenant_id + created_at
tenant_id + email
tenant_id + product_id
tenant_id + order_id
tenant_id + event_id
tenant_id + idempotency_key
```

Gợi ý index theo context:

```
users: tenant_id + email
products: tenant_id + catalog_id + status
carts: tenant_id + customer_id
orders: tenant_id + customer_id + created_at
orders: tenant_id + order_code
inventory_reservations: tenant_id + order_id
payment_transactions: tenant_id + provider_transaction_id
shipments: tenant_id + order_id
outbox_messages: status + created_at
inbox_messages: tenant_id + event_id + consumer_name
idempotency_records: tenant_id + operation + idempotency_key
```

Rule:

```
Every tenant-scoped query must have tenant-aware index consideration.
```

---

## 8. Outbox Schema

Outbox table lưu event cần publish sau khi domain transaction thành công.

```sql
CREATE TABLE outbox_messages (
  id varchar PRIMARY KEY,
  tenant_id varchar NOT NULL,
  event_id varchar NOT NULL,
  event_name varchar NOT NULL,
  event_version int NOT NULL,
  aggregate_id varchar NOT NULL,
  aggregate_type varchar NOT NULL,
  correlation_id varchar NOT NULL,
  causation_id varchar,
  producer varchar NOT NULL,
  payload jsonb NOT NULL,
  status varchar NOT NULL,
  retry_count int NOT NULL DEFAULT 0,
  occurred_at timestamptz NOT NULL,
  published_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
```

Indexes:

```sql
CREATE UNIQUE INDEX uq_outbox_event_id ON outbox_messages(event_id);
CREATE INDEX idx_outbox_status_created_at ON outbox_messages(status, created_at);
CREATE INDEX idx_outbox_tenant_event ON outbox_messages(tenant_id, event_name);
```

Rules:

- Aggregate change và outbox insert phải nằm cùng transaction.
- Worker chỉ publish message có status `pending` hoặc retryable `failed`.
- Không xóa outbox sớm nếu chưa có retention policy.

---

## 9. Inbox Schema

Inbox table dùng để consumer chống xử lý duplicate event.

```sql
CREATE TABLE inbox_messages (
  id varchar PRIMARY KEY,
  tenant_id varchar NOT NULL,
  event_id varchar NOT NULL,
  consumer_name varchar NOT NULL,
  event_name varchar NOT NULL,
  status varchar NOT NULL,
  retry_count int NOT NULL DEFAULT 0,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
```

Indexes:

```sql
CREATE UNIQUE INDEX uq_inbox_event_consumer ON inbox_messages(event_id, consumer_name);
CREATE INDEX idx_inbox_tenant_status ON inbox_messages(tenant_id, status);
```

Rules:

- Consumer phải ghi inbox trước hoặc trong transaction xử lý event.
- Duplicate `event_id + consumer_name` phải bị ignore hoặc trả idempotent success.
- Failed inbox message cần retry/DLQ strategy.

---

## 10. Idempotency Schema

Idempotency table dùng để chống duplicate command/webhook mutation.

```sql
CREATE TABLE idempotency_records (
  id varchar PRIMARY KEY,
  tenant_id varchar NOT NULL,
  operation varchar NOT NULL,
  idempotency_key varchar NOT NULL,
  request_hash varchar,
  response_snapshot jsonb,
  status varchar NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  expires_at timestamptz
);
```

Indexes:

```sql
CREATE UNIQUE INDEX uq_idempotency_operation_key
ON idempotency_records(tenant_id, operation, idempotency_key);

CREATE INDEX idx_idempotency_expires_at
ON idempotency_records(expires_at);
```

Rules:

- Same key + same request_hash trả lại response cũ nếu completed.
- Same key + different request_hash trả `IDEMPOTENCY_CONFLICT`.
- Idempotency records phải có TTL phù hợp business flow.
- Payment webhook, checkout, refund, shipment creation bắt buộc idempotent.

---

## 11. Read Model Strategy

Read model dùng để phục vụ query/UI mà không làm aggregate phình to hoặc expose internal domain structure.

Ví dụ read model có thể cần:

```
product_cards
order_summaries
customer_order_history
admin_order_dashboard
shipment_tracking_view
```

Quy tắc:

- Read model có thể denormalized.
- Read model không phải source of truth.
- Read model có thể rebuild từ source table/event nếu cần.
- Không mutate business state trực tiếp trên read model.
- Read model phải tenant-scoped nếu chứa tenant data.

Ví dụ:

```sql
CREATE TABLE order_summaries (
  id varchar PRIMARY KEY,
  tenant_id varchar NOT NULL,
  order_id varchar NOT NULL,
  order_code varchar NOT NULL,
  customer_id varchar NOT NULL,
  total_amount decimal NOT NULL,
  order_status varchar NOT NULL,
  payment_status varchar,
  shipment_status varchar,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
```

---

## 12. Audit Log Schema

Audit log lưu hành động quan trọng ảnh hưởng business/security.

```sql
CREATE TABLE audit_logs (
  id varchar PRIMARY KEY,
  tenant_id varchar NOT NULL,
  actor_id varchar,
  action varchar NOT NULL,
  target_type varchar NOT NULL,
  target_id varchar NOT NULL,
  metadata jsonb,
  correlation_id varchar NOT NULL,
  occurred_at timestamptz NOT NULL
);
```

Indexes:

```sql
CREATE INDEX idx_audit_tenant_target ON audit_logs(tenant_id, target_type, target_id);
CREATE INDEX idx_audit_tenant_actor ON audit_logs(tenant_id, actor_id, occurred_at);
CREATE INDEX idx_audit_correlation ON audit_logs(correlation_id);
```

Rules:

- Audit log nên append-only.
- Không lưu secret trong metadata.
- Admin override phải có reason trong metadata.
- Audit log không thay thế integration event.

---

## 13. Migration Strategy

Migration phải được version control và chạy qua pipeline rõ ràng.

Quy tắc:

- Không sửa production schema bằng tay nếu không có incident procedure.
- Migration phải review trước khi chạy production.
- Migration phá dữ liệu phải có backup/rollback plan.
- Migration nên nhỏ, dễ review, dễ rollback.
- Application deploy và migration deploy phải có thứ tự rõ.

Migration checklist:

```
[ ] Migration file committed
[ ] Backward compatibility checked
[ ] Existing data impact checked
[ ] Index creation impact checked
[ ] Rollback strategy documented
[ ] Production run order documented
```

---

## 14. Expand-and-Contract Migration Pattern

Breaking schema change phải đi theo hướng expand-and-contract.

```
1. Add new column/table
2. Deploy code that writes both old and new fields if needed
3. Backfill existing data
4. Switch read path to new field/table
5. Stop writing old field
6. Remove old field in a later release
```

Ví dụ đổi `orders.total_amount` sang `orders.pricing_snapshot`:

```
Release 1: add pricing_snapshot jsonb
Release 2: write both total_amount and pricing_snapshot
Backfill: populate pricing_snapshot for old orders
Release 3: read from pricing_snapshot
Release 4: stop using total_amount
Release 5: drop total_amount after safe window
```

Không làm:

```
rename/drop column and deploy app change in same risky release
```

---

## 15. Concurrency and Versioning

Các aggregate có khả năng concurrent update phải dùng optimistic locking hoặc database constraint phù hợp.

Các bảng cần `version`:

```
products
carts
orders
product_inventory
vouchers
shipments
invoices
```

Update pattern:

```sql
UPDATE product_inventory
SET quantity = quantity - 1,
    version = version + 1,
    updated_at = now()
WHERE id = :id
  AND tenant_id = :tenant_id
  AND version = :expected_version;
```

Nếu affected rows = 0:

```
CONCURRENT_UPDATE_DETECTED
```

Bắt buộc test concurrency cho:

```
inventory reservation
voucher usage
payment confirmation
shipment status transition
stock adjustment
```

---

## 16. Data Retention and Archival

Không phải dữ liệu nào cũng giữ mãi trong bảng operational nóng.

Cần retention policy cho:

```
outbox_messages
inbox_messages
idempotency_records
user_sessions
audit_logs
webhook raw payloads
```

Gợi ý:

```
outbox/inbox successful records: archive or delete after retention window
failed records: keep until resolved or manually archived
idempotency records: TTL theo business flow
sessions: cleanup after expiration
webhook payload: keep long enough for reconciliation
```

Rule:

```
Do not delete operational evidence before reconciliation/audit window ends.
```

---

## 17. Backup and Recovery

Backup strategy là một phần của schema design, không phải việc nghĩ sau khi mất data.

MVP cần:

```
regular database backup
backup restore test
migration rollback plan
manual export for critical tables if needed
```

Critical tables:

```
users
orders
order_items
invoices
payment_transactions
refund_transactions
product_inventory
inventory_reservations
outbox_messages
audit_logs
```

Rule:

```
A backup that has never been restored is just a comforting rumor.

---

## 18. Multi-Tenant Data Isolation Evolution

MVP dùng `tenant_id` trên mọi bảng tenant-scoped.

Evolution path:

```

Phase 1: shared database + tenant_id column

Phase 2: tenant-aware indexes and query guards

Phase 3: optional schema-per-context

Phase 4: optional tenant partitioning for large tenants

Phase 5: optional database-per-tenant for enterprise tenants

```

Quy tắc:

- Mọi repository query tenant-scoped phải filter `tenant_id`.
- Không dùng tenantId từ request body.
- Không tạo global unique constraint nếu business rule là tenant-local.
- Unique index nên bao gồm tenant_id nếu uniqueness chỉ áp dụng trong tenant.

Ví dụ:

```

CREATE UNIQUE INDEX uq_users_tenant_email

ON users(tenant_id, email);

```

---

## 19. Partitioning and Sharding Future Strategy

Không partition/shard trong MVP nếu chưa có data volume thật.

Candidate partition tables sau này:

```

outbox_messages

inbox_messages

audit_logs

payment_transactions

orders

order_summaries

```

Partition key gợi ý:

```

tenant_id

created_at

occurred_at

```

Quy tắc:

- Partition khi có số liệu về volume và slow query.
- Không partition chỉ vì nghe có vẻ enterprise.
- Trước khi shard, phải có tenant ownership và migration strategy rõ.
- Sharding là operational decision, không phải trang trí kiến trúc.

---

## 20. Event Replay and Projection Rebuild Strategy

Read model/projection có thể rebuild nếu source event hoặc source table còn đủ dữ liệu.

Rebuild candidates:

```

order_summaries

product_cards

shipment_tracking_view

admin_order_dashboard

analytics_projection

```

Quy tắc:

- Projection rebuild không được mutate source of truth.
- Rebuild job phải idempotent.
- Rebuild job phải chạy theo batch.
- Rebuild phải có checkpoint nếu data lớn.
- Rebuild nên log correlation/job id.

Ví dụ checkpoint:

```

projection_name

last_processed_event_id

last_processed_at

status

```

---

## 21. Soft Delete Strategy

Soft delete chỉ dùng khi business cần restore, audit hoặc legal hold.

Nên dùng soft delete cho:

```

products

catalogs

addresses

vouchers

```

Không nên soft delete tùy tiện cho:

```

payment_transactions

outbox_messages

inbox_messages

audit_logs

```

Các bảng tài chính/audit nên immutable hoặc append-only thay vì soft delete.

Quy tắc:

- Nếu dùng `deleted_at`, mọi query active phải filter rõ.
- Unique constraint cần tính tới deleted record.
- Soft delete không thay thế archival policy.

---

## 22. Data Lifecycle Summary

```

Operational tables

→ Archive tables / cold storage if needed

→ Retention policy

→ Backup

→ Restore test

```

Hot operational tables:

```

carts

orders

product_inventory

payment_transactions

shipments

outbox_messages pending/failed

```

Warm tables:

```

completed orders

invoices

shipment history

audit logs recent

```

Cold/archive candidates:

```

old outbox/inbox processed records

old audit logs

old webhook raw payloads

old sessions

```

Rule:

```

Data lifecycle must be explicit before data volume forces panic design.

```

---

## 23. Disaster Recovery Tiers

MVP disaster recovery tối thiểu:

```

Tier 0: local dev data can be recreated

Tier 1: staging can be recreated from migration + seed

Tier 2: production requires backup + restore plan

```

Production checklist:

```

[ ] Automated backup configured

[ ] Restore procedure documented

[ ] Restore tested at least once

[ ] Migration rollback strategy documented

[ ] Critical table export strategy considered

[ ] Incident owner identified

```

Rule:

```

Recovery plan that exists only in someone's head does not exist.

```

---

## 24. Database Design Final Checklist

Before implementing a table:

```

[ ] Which bounded context owns this table?

[ ] Is this table tenant-scoped?

[ ] Does it need tenant_id?

[ ] Does it need version for optimistic locking?

[ ] Does it need status lifecycle?

[ ] Does it need created_at / updated_at?

[ ] Does it need audit log instead of mutable history?

[ ] Does it reference another context only by business ID?

[ ] Does it avoid cross-context FK?

[ ] What are the primary query patterns?

[ ] What indexes support those queries?

[ ] What is the retention policy?

[ ] Is migration rollback possible?

```

If the ownership is unclear, do not create the table yet.

Database schema is not just storage. It is architecture cast into concrete.
```