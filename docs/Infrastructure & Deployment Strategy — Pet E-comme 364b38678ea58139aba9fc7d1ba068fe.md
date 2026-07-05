# Infrastructure & Deployment Strategy — Pet E-commerce

Trang này mô tả chiến lược hạ tầng và triển khai cho Pet E-commerce theo hướng Modular Monolith, DDD, Event-Driven internal flow và microservice-ready.

---

## 1. Deployment Principle

```
One codebase
One backend deployable
Multiple bounded context modules
API runtime mode
Worker runtime mode
Shared PostgreSQL deployment
Optional Redis
Object storage for media
```

Không triển khai microservice ngay từ đầu.

Rule:

```
Deployment simplicity first, extraction readiness second.
```

---

## 2. Runtime Modes

Một codebase có thể chạy nhiều mode.

```
APP_MODE=api
APP_MODE=worker
APP_MODE=scheduler
```

API mode xử lý HTTP request, auth middleware, RequestContext, TenantContext và synchronous use cases.

Worker mode xử lý outbox publishing, inbox retry, payment reconciliation, expired reservation cleanup, session cleanup và projection rebuild.

Scheduler mode xử lý periodic jobs, retention cleanup và reconciliation trigger.

Rule:

```
Same codebase does not mean same process responsibility.
```

---

## 3. MVP Infrastructure Topology

```
Client / Browser
    ↓
Backend API Process
    ↓
PostgreSQL
    ↓
Outbox Worker Process

Optional:
Redis
Object Storage
Payment Provider
Shipping Provider
```

Components:

```
Backend API: serves HTTP requests
Worker: processes async jobs/events
PostgreSQL: source of truth
Redis: cache/lock/session helper only
Object Storage: product media
Payment Provider: online payment integration
Shipping Provider: shipment/tracking integration
```

Redis rule:

```
Redis is not source of truth for business state.
```

---

## 4. Local Development Infrastructure

Local stack gợi ý:

```
backend-api
backend-worker
postgres
redis optional
local object storage emulator optional
mock payment provider
mock shipping provider
```

Docker Compose services:

```
app-api
app-worker
postgres
redis
minio optional
```

Local commands:

```
pnpm install
pnpm dev:api
pnpm dev:worker
pnpm db:migrate
pnpm db:seed
pnpm test
pnpm test:integration
```

Rules:

- Local seed data phải deterministic.
- Local worker nên chạy được để test outbox flow.
- External providers nên mock bằng adapter.
- Không hardcode local-only behavior trong domain/application layer.

---

## 5. Environment Configuration

Required env examples:

```
APP_ENV
APP_MODE
PORT
DATABASE_URL
JWT_SECRET
REFRESH_TOKEN_SECRET
LOG_LEVEL
EVENT_BUS_MODE
OUTBOX_WORKER_ENABLED
IDEMPOTENCY_TTL_SECONDS
PAYMENT_PROVIDER_SECRET
SHIPPING_PROVIDER_SECRET
OBJECT_STORAGE_BUCKET
```

Rules:

- Validate config at bootstrap.
- Missing required config must fail fast.
- Secrets must not be committed.
- Production secrets should be injected from environment or secret manager.
- Config changes must be documented in release notes.

---

## 6. Containerization Strategy

Backend image nên là immutable artifact.

Container image build:

```
install dependencies
run typecheck
run tests if in CI
build app
copy production artifacts
run as non-root user if possible
```

Runtime command examples:

```
node dist/main.js --mode=api
node dist/main.js --mode=worker
node dist/main.js --mode=scheduler
```

Rules:

- Same image can run different APP_MODE.
- Config provided at runtime.
- Do not bake secrets into image.
- Image tag should include commit SHA or release version.

---

## 7. Database Deployment Strategy

MVP dùng một PostgreSQL deployment.

Rules:

- Migration runs before application deploy if backward-compatible.
- Destructive migration requires backup and rollback plan.
- Migration files are version controlled.
- Application must not auto-run risky production migrations silently.
- Connection pool should be configured per runtime mode.

Connection pool consideration:

```
API process: request-driven pool
Worker process: batch-driven pool
Scheduler process: low concurrency pool
```

---

## 8. Object Storage Strategy

Product media không lưu binary trong database.

Database lưu:

```
media_id
product_id
url or object_key
media_type
is_primary
metadata optional
```

Object storage lưu image/video binary.

Rules:

- Use signed upload URL if direct upload from frontend is needed.
- Validate file type/size.
- Store object key/reference in DB.
- Deleting product should not immediately delete media if audit/recovery window is needed.

---

## 9. Network & API Gateway Strategy

Recommended layers:

```
Client
→ CDN / Reverse Proxy optional
→ API Process
→ Database / External Providers
```

Gateway/reverse proxy responsibilities:

```
TLS termination
request size limit
basic rate limit
forward request id
timeout control
```

Rules:

- Backend still validates auth and tenant context.
- Gateway is not a replacement for application security.
- Webhook routes may need raw body preservation for signature verification.

---

## 10. Scaling Strategy

MVP scale path:

```
1. Vertical scale database if needed
2. Scale API process horizontally
3. Scale worker process separately
4. Tune indexes and query patterns
5. Add cache for read-heavy safe data
6. Add broker if in-process event bus is insufficient
7. Extract bounded context only when justified
```

Rules:

- Scale based on metrics, not vibes.
- API and worker can scale independently by runtime mode.
- Do not introduce Kafka/RabbitMQ before outbox/in-process flow proves insufficient.
- Do not extract microservice just to solve bad module boundaries.

---

## 11. Cache Strategy

Cache candidates:

```
catalog tree
published product cards
product detail lightweight view
configuration/reference data
```

Do not cache as source of truth:

```
cart final amount
inventory quantity
payment status
order status
voucher usage count
```

Rules:

- Cache invalidation must be explicit.
- Cache must tolerate stale reads only where business allows.
- Checkout must validate against source of truth.
- Redis/cache outage should degrade gracefully where possible.

---

## 12. Background Jobs Deployment

Worker types:

```
OutboxWorker
InboxRetryWorker
ExpiredReservationWorker
PaymentReconciliationWorker
SessionCleanupWorker
ProjectionRebuildWorker
RetentionCleanupWorker
```

Rules:

- Worker has health/readiness check if deployed separately.
- Worker logs batch start/end/error.
- Worker has max batch size.
- Worker has retry/backoff policy.
- Worker should not bypass application use cases.

---

## 13. Deployment Pipeline

Minimum pipeline:

```
install dependencies
lint
typecheck
unit tests
integration tests
contract tests
build app
build container image
migration check
push image
deploy to environment
smoke test
```

Quality gate:

```
[ ] Lint pass
[ ] Typecheck pass
[ ] Tests pass
[ ] Migration reviewed
[ ] Config documented
[ ] Rollback plan exists
```

Rule:

```
A deploy without rollback plan is just optimism with a timestamp.
```

---

## 14. Environment Strategy

Recommended environments:

```
local
preview optional
staging
production
```

Rules:

- Local can use mock providers.
- Staging should mimic production architecture as much as practical.
- Production secrets must not be reused in staging/local.
- Test data must not contain real sensitive customer data unless policy exists.

---

## 15. Release Strategy

Release modes:

```
regular release
hotfix release
migration-only release
feature-flagged release
rollback release
```

Rules:

- Risky migration should be separated from risky behavior change.
- Feature flags should have owner and removal date.
- Hotfix should include post-incident follow-up.
- Release notes should mention config/migration changes.

---

## 16. Provider Integration Deployment

Rules:

- Provider secrets are environment-specific.
- Webhook URLs are environment-specific.
- Webhook signature verification must be enabled before production traffic.
- Provider sandbox and production credentials must be isolated.
- Provider callbacks must be idempotent.

Checklist:

```
[ ] Sandbox credentials configured
[ ] Production credentials stored securely
[ ] Webhook endpoint registered
[ ] Signature verification tested
[ ] Duplicate webhook tested
[ ] Reconciliation path documented
```

---

## 17. Infrastructure Evolution Path

Evolution path:

```
Phase 1: Docker Compose local + simple deploy
Phase 2: Managed PostgreSQL + container deployment
Phase 3: Separate API and worker runtime scaling
Phase 4: Add Redis for lock/cache if needed
Phase 5: Add broker if event volume requires it
Phase 6: Extract selected bounded context when justified
Phase 7: Add advanced orchestration only when operationally needed
```

Not needed at MVP:

```
Kubernetes
Kafka cluster
service mesh
multi-region active-active
database sharding
full microservice deployment
```

Rule:

```
Complex infrastructure should be earned by real constraints.
```

---

## 18. Infrastructure Checklist Before Coding

```
[ ] Local Docker Compose plan exists
[ ] PostgreSQL migration flow selected
[ ] APP_MODE strategy defined
[ ] Config validation planned
[ ] Secret handling documented
[ ] Object storage strategy decided
[ ] Worker deployment strategy defined
[ ] Health endpoints defined
[ ] Deployment pipeline outline exists
[ ] Rollback strategy documented
```

If deployment strategy is unclear, implementation will eventually invent one badly.

Infrastructure is not the goal. It is the road that lets the product survive outside [localhost](http://localhost).