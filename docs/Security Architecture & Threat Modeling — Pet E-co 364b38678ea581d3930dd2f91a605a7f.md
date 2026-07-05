# Security Architecture & Threat Modeling — Pet E-commerce

Trang này mô tả security architecture và threat modeling cho Pet E-commerce SaaS multi-tenant.

Mục tiêu là xác định các rủi ro bảo mật cốt lõi ngay từ thiết kế, thay vì chờ production leak data rồi mới gọi đó là “bài học kinh nghiệm”.

---

## 1. Security Principles

Nguyên tắc chính:

```
Tenant isolation is mandatory
Never trust client input
Authentication is not authorization
Secrets must not leak
Webhook must be verified
Payment flow must be idempotent
Sensitive data must be minimized
Audit important manual actions
```

Rule:

```
Security must protect data boundaries, money flow, and operational control.
```

---

## 2. Security Scope

Trong scope MVP:

```
Authentication
Session management
Refresh token rotation
Tenant isolation
API input validation
Webhook signature verification
Secrets management
Audit log for admin actions
Basic rate limiting
Security logging
```

Ngoài scope MVP nhưng cần chuẩn bị:

```
Full RBAC/ABAC
Fine-grained policy engine
MFA
Device trust
Advanced fraud detection
WAF rules
SIEM integration
DLP policy
```

Rule:

```
MVP security can be simple, but it cannot be careless.
```

---

## 3. Authentication Model

User Context quản lý:

```
UserProfile
UserIdentity
UserSession
```

Authentication flow:

```
Register
→ Login
→ Access token issued
→ Refresh token issued
→ Refresh token stored as hash
→ Refresh token rotation
→ Logout revokes session
```

Rules:

- Password phải hash bằng bcrypt/argon2.
- Refresh token lưu dạng hash.
- Access token có expiration ngắn.
- Refresh token có expiration dài hơn nhưng phải rotate.
- Logout revoke current session.
- Change password có thể revoke all other sessions.

Do not store:

```
plaintext password
plaintext refresh token
plaintext provider secret
```

---

## 4. Authorization Model for MVP

MVP chưa triển khai RBAC/ABAC full.

Authorization tối thiểu:

```
authenticated user
admin/backoffice placeholder
tenant scope check
resource ownership check
```

Rules:

- Customer chỉ truy cập resource của chính mình trong tenant.
- Admin API phải tenant-scoped.
- Admin mutation phải đi qua use case, không bypass domain.
- Admin override phải có reason và audit log.

Future evolution:

```
User Context
→ IAM / Authorization Context
→ Role/Permission
→ Policy/ABAC if needed
```

---

## 5. Tenant Isolation Threat Model

Tenant leak là rủi ro nghiêm trọng nhất với SaaS.

Threats:

```
Client sends another tenantId in request body
Repository query forgets tenant_id filter
Admin endpoint bypasses tenant scope
Background worker processes event without tenantId
Read model built without tenant partition
Cache key missing tenantId
```

Controls:

```
TenantContext resolved server-side
tenant_id required on tenant-scoped tables
repository query filter by tenant_id
tenant-aware indexes
event envelope includes tenantId
cache key includes tenantId
integration tests for tenant mismatch
```

Rule:

```
tenantId from client body is untrusted input.
```

---

## 6. API Security

API must validate both shape and business access.

Controls:

```
auth middleware
request DTO validation
rate limit for auth endpoints
tenant context middleware
error response normalization
no internal stack trace in response
pagination limit
request size limit
```

Rules:

- Return stable error code, not internal exception detail.
- Do not expose passwordHash, refreshTokenHash, provider token.
- Do not expose internal infrastructure errors directly.
- Public list APIs must be paginated.
- Admin APIs require stricter authorization placeholder.

---

## 7. Webhook Security

Webhook endpoint là attack surface quan trọng.

Threats:

```
fake payment success webhook
replay old webhook
duplicate webhook
modified amount
invalid signature
providerTransactionId collision
```

Controls:

```
verify provider signature
store raw payload/audit reference
idempotency by providerTransactionId/event id
validate amount against invoice
validate order/payment state transition
reject unsupported provider
log correlationId/providerTransactionId
```

Rules:

- Never trust webhook payload without signature verification.
- Payment success must validate amount/currency/order reference.
- Duplicate webhook must not duplicate state transition.
- Failed webhook should be retryable only when failure is infrastructure-related.

---

## 8. Payment Security

Payment flow protects money state.

Threats:

```
amount tampering
invoice mismatch
duplicate payment confirmation
refund duplicate
payment status forged by client
race condition between payment failed and succeeded
```

Controls:

```
server-side invoice amount
provider signature verification
idempotency key
providerTransactionId unique constraint
payment state machine
refund state machine
audit log for manual correction
```

Rules:

- Client cannot mark order paid.
- Payment provider confirmation is required for online payment success.
- COD payment success depends on CODCollected event, not shipment creation.
- Refund must be idempotent.

---

## 9. Inventory Abuse & Consistency Risks

Threats:

```
double checkout submit
concurrent reservation oversell
manual stock adjustment abuse
stale cart price/availability
expired reservation not released
```

Controls:

```
checkout idempotency
inventory reservation transaction
optimistic locking/version
stock adjustment audit log
reservation expiration worker
concurrency tests
```

Rules:

- Inventory reservation is required before order confirmation.
- Manual stock adjustment requires reason.
- Reservation release/confirm must be idempotent.

---

## 10. Secrets Management

Secrets include:

```
JWT_SECRET
REFRESH_TOKEN_SECRET
DATABASE_URL password
PAYMENT_PROVIDER_SECRET
SHIPPING_PROVIDER_SECRET
OBJECT_STORAGE_SECRET
WEBHOOK_SECRET
```

Rules:

- Do not commit secrets.
- Do not log secrets.
- Do not expose secrets in API response.
- Use environment injection or secret manager in production.
- Rotate secrets when leaked or on operational schedule.
- Separate sandbox and production secrets.

Secret leak response:

```
[ ] Revoke/rotate leaked secret
[ ] Check logs/artifacts for exposure
[ ] Identify affected environment
[ ] Audit suspicious activity
[ ] Document incident
```

---

## 11. Sensitive Data Handling

Sensitive data:

```
password
passwordHash
refreshTokenHash
accessToken
payment provider token
webhook signature
customer phone/address
payment transaction reference
```

Rules:

- Minimize sensitive data in logs.
- Mask phone/address if displayed in admin list where full value is unnecessary.
- Do not store full payment card data.
- Use provider-hosted payment where possible.
- Audit access to sensitive admin operations if needed.

---

## 12. Rate Limiting and Abuse Protection

MVP rate limit candidates:

```
login
register
refresh token
password change
voucher apply
checkout
payment initiate
webhook endpoint by provider/IP if feasible
```

Controls:

```
per IP limit
per user limit
per tenant limit
captcha optional for abuse-heavy auth flow
lockout policy optional
```

Rules:

- Rate limit auth endpoints earlier than other endpoints.
- Do not leak whether email exists if security policy requires generic response.
- Rate limiting should not break legitimate webhook retries.

---

## 13. Security Logging

Security-relevant events:

```
login success
login failed
logout
refresh token reused/revoked
password changed
admin override
stock adjustment
refund requested
payment webhook invalid signature
tenant access denied
```

Log metadata:

```
tenantId
userId optional
ip
userAgent
correlationId
operationName
errorCode
```

Rules:

- Do not log raw token/password.
- Security logs should be searchable by correlationId and actorId.
- Repeated suspicious failures should be measurable.

---

## 14. Threat Modeling Matrix

| Threat | Impact | Control |
| --- | --- | --- |
| Cross-tenant data access | Critical | TenantContext + tenant_id filter + tests |
| Fake payment webhook | Critical | Signature verification + amount validation |
| Duplicate checkout | High | Idempotency key + order dedupe |
| Oversell inventory | High | Reservation + optimistic locking |
| Refresh token theft | High | Token hashing + rotation + revoke |
| Admin abuse | High | Audit log + reason + tenant scope |
| Secret leak | Critical | Secret manager + rotation + no logging |
| API scraping | Medium | Pagination + rate limiting |
| Stale price checkout | Medium | Pricing snapshot validation |
| XSS through product content | Medium | Output escaping/sanitization in FE |

---

## 15. Security Test Checklist

```
[ ] Tenant A cannot read Tenant B data
[ ] Request body tenantId is ignored/rejected
[ ] Password hash never returned by API
[ ] Refresh token stored as hash
[ ] Revoked refresh token cannot refresh
[ ] Blocked user cannot login
[ ] Invalid webhook signature rejected
[ ] Duplicate payment webhook is idempotent
[ ] Payment amount mismatch rejected
[ ] Checkout duplicate request does not create duplicate order
[ ] Admin stock adjustment requires reason
[ ] Admin action writes audit log
[ ] API does not expose stack trace
[ ] Public list endpoint enforces pagination limit
```

---

## 16. Security Incident Runbook

### Tenant Leak Suspected

```
[ ] Freeze affected deployment if needed
[ ] Identify affected endpoint/query
[ ] Identify affected tenants
[ ] Check logs by correlationId/requestId
[ ] Patch tenant filter immediately
[ ] Audit data exposure
[ ] Notify according to policy
[ ] Add regression test
[ ] Write postmortem
```

### Payment Integrity Incident

```
[ ] Pause affected payment processing if needed
[ ] Identify affected providerTransactionIds
[ ] Compare invoice amount vs provider amount
[ ] Check duplicate idempotency records
[ ] Reconcile order/payment state
[ ] Audit manual corrections
[ ] Add regression test
```

### Secret Leak Incident

```
[ ] Rotate leaked secret
[ ] Revoke affected tokens/credentials
[ ] Check deployment artifacts/logs
[ ] Check access history
[ ] Document blast radius
[ ] Add prevention action
```

---

## 17. Security Architecture Evolution

MVP:

```
authentication
session management
tenant isolation
basic admin placeholder
webhook verification
idempotency
security logs
```

Next phase:

```
RBAC
admin permission model
MFA optional
provider key rotation automation
security dashboard
rate limit tuning
```

Later:

```
ABAC/policy engine
SIEM integration
advanced fraud detection
field-level encryption for sensitive fields if needed
```

Rule:

```
Security should evolve by risk, not by buzzword.
```

---

## 18. Final Security Checklist Before Production-like Demo

```
[ ] Auth endpoints implemented safely
[ ] Refresh token rotation works
[ ] Tenant isolation tests exist
[ ] Webhook signature verification works
[ ] Checkout idempotency works
[ ] Payment amount validation works
[ ] Admin audit log works
[ ] Secrets are not committed
[ ] Logs do not contain tokens/passwords
[ ] API error does not expose stack trace
[ ] Security test checklist passes
```

Rule:

```
A SaaS system without tenant isolation is not unfinished. It is unsafe.
```