# Frontend Architecture & UI Engineering Strategy — Pet E-commerce

Trang này mô tả kiến trúc frontend cho Pet E-commerce theo hướng modular, API-contract-first và production-aware UX.

Mục tiêu là đảm bảo frontend không chỉ render được màn hình, mà còn hiểu state machine, error code, caching, form validation và checkout flow. Vì vâng, UI không chỉ là `map(products)` rồi cầu nguyện.

---

## 1. Frontend Architecture Principles

Nguyên tắc chính:

```
API contract first
Feature/module boundary rõ
Server state và client UI state tách biệt
Error handling dựa trên error.code
Form validation align với backend DTO
Critical checkout flow phải deterministic
```

Không làm:

```
Call API trực tiếp lung tung trong component
Parse error.message để xử lý logic
Duplicate DTO bằng tay không kiểm soát
Store server state trong global UI store vô tội vạ
Hardcode business rule khác backend
```

Rule:

```
Frontend should mirror product flow, not backend database tables.
```

---

## 2. Suggested Frontend Stack

Gợi ý stack cho MVP:

```
Framework: Next.js hoặc React SPA
Language: TypeScript
Server state: TanStack Query
Form: React Hook Form
Schema validation: Zod
API client: generated or typed SDK wrapper
UI state: Zustand/Jotai hoặc local state
Styling: TailwindCSS hoặc component library
Testing: Vitest/Jest + Testing Library + Playwright
```

Rule chọn tech:

- Ưu tiên stack quen thuộc để ship.
- Không over-engineer state management.
- Không dùng global store cho mọi thứ.
- Không để UI framework quyết định business flow.

---

## 3. Frontend Module Boundary

Gợi ý structure:

```
src/
  app/
  shared/
    api/
    ui/
    config/
    errors/
    utils/
  features/
    auth/
    catalog/
    product/
    cart/
    checkout/
    order/
    payment/
    shipment/
    admin/
```

Mỗi feature nên có:

```
api.ts
components/
hooks/
types.ts
schema.ts
pages or routes
```

Quy tắc:

- Feature không import internal component/hook của feature khác nếu không qua public export.
- Shared UI không chứa business logic.
- Shared API client chỉ chứa transport/common handling.
- Business-specific data mapping nên nằm trong feature layer.

---

## 4. Routing Strategy

Customer routes:

```
/
/products
/products/:productId
/cart
/checkout
/orders
/orders/:orderId
/orders/:orderId/shipment
/me
/login
/register
```

Admin routes:

```
/admin
/admin/products
/admin/products/:productId
/admin/catalogs
/admin/inventory
/admin/orders
/admin/orders/:orderId
/admin/shipments
/admin/vouchers
```

Route guard rules:

- Guest có thể vào product listing/detail.
- Checkout yêu cầu authenticated customer.
- Admin routes yêu cầu admin/backoffice permission placeholder.
- Tenant context phải resolve trước khi gọi tenant-scoped API.

---

## 5. Server State Strategy

Server state dùng TanStack Query hoặc abstraction tương đương.

Query key convention:

```tsx
const queryKeys = {
  products: (params: ListProductsQuery) => ["products", params],
  productDetail: (productId: string) => ["product", productId],
  cart: () => ["cart"],
  orders: (params: ListOrdersQuery) => ["orders", params],
  orderDetail: (orderId: string) => ["order", orderId],
  shipment: (orderId: string) => ["shipment", orderId],
}
```

Rules:

- Product listing/detail có thể cache ngắn.
- Cart query phải invalidate sau add/update/remove/apply voucher.
- Checkout success phải invalidate cart và orders.
- Payment success/failure phải invalidate order detail/invoice.
- Shipment update phải invalidate shipment/order detail.

---

## 6. Client UI State Strategy

Client state chỉ chứa trạng thái UI tạm thời:

```
modal open/close
selected tab
local filter before submit
form draft
toast state
checkout step
```

Không nên chứa:

```
cart source of truth
order source of truth
payment status source of truth
inventory source of truth
```

Rule:

```
Server truth belongs to server state, not global UI store.
```

---

## 7. Form Validation Strategy

Form validation có hai lớp:

```
Frontend shape validation
Backend business validation
```

Frontend validate:

```
required field
email format
phone format
min/max length
positive quantity
```

Backend vẫn validate:

```
tenant access
product available
inventory enough
voucher valid
payment amount match
order state transition
```

Zod schema ví dụ:

```tsx
const addCartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
})
```

Rule:

```
Frontend validation improves UX. Backend validation protects business truth.
```

---

## 8. Error Handling Strategy

Frontend xử lý error theo `error.code`.

Mapping examples:

```
PRODUCT_NOT_AVAILABLE -> show product unavailable message
INSUFFICIENT_STOCK -> highlight cart item and disable checkout
PRICE_CHANGED -> refresh cart pricing and ask user to confirm
VOUCHER_EXPIRED -> remove voucher and show expired message
PAYMENT_AMOUNT_MISMATCH -> show payment verification failed
TENANT_ACCESS_DENIED -> redirect or show access denied
SESSION_REVOKED -> force logout
```

Rules:

- Không parse `message` để xử lý logic.
- `message` dùng để hiển thị fallback.
- Error boundary dùng cho unexpected UI crash.
- API error phải hiển thị correlationId khi cần support/debug.

---

## 9. Checkout UI State Machine

Checkout không nên là một form submit đơn giản.

State gợi ý:

```
cart_review
address_selection
shipping_selection
payment_selection
submitting
order_created
payment_redirect
payment_pending
payment_failed
completed
```

Transitions:

```
cart_review -> address_selection
address_selection -> shipping_selection
shipping_selection -> payment_selection
payment_selection -> submitting
submitting -> order_created
order_created -> payment_redirect if online
order_created -> completed if COD confirmed order created
payment_pending -> completed
payment_pending -> payment_failed
payment_failed -> payment_selection or retry
```

Rules:

- Double submit phải bị chặn ở UI và backend idempotency.
- Checkout button disabled khi cart invalid.
- Nếu backend trả PRICE_CHANGED, UI refresh cart và yêu cầu user xác nhận lại.
- Nếu backend trả INSUFFICIENT_STOCK, UI highlight item lỗi.

---

## 10. Admin UI Strategy

Admin UI ưu tiên operational clarity hơn visual beauty.

Admin screens cần:

```
filter rõ
search rõ
status badge rõ
audit timeline
reason input cho override
confirmation modal cho destructive action
```

Admin mutations cần reason:

```
stock adjustment
order cancellation
manual shipment status update
refund approval
voucher force expire
```

Rule:

```
Admin action that changes business state should be auditable from UI to backend.
```

---

## 11. API SDK Strategy

Frontend không nên gọi `fetch` raw ở mọi component.

Nên có API client layer:

```
shared/api/httpClient.ts
features/cart/cartApi.ts
features/order/orderApi.ts
features/product/productApi.ts
```

httpClient chịu trách nhiệm:

```
base URL
auth header
correlation/request header nếu cần
JSON parse
ApiErrorResponse mapping
refresh token flow nếu áp dụng
```

Feature API chịu trách nhiệm:

```
endpoint path
request DTO
response DTO
feature-specific mapping
```

---

## 12. Testing Strategy for Frontend

Test layers:

```
Unit: pure mapper/helper
Component: UI states
Hook/query: API state handling
E2E: critical user flow
```

Critical FE tests:

```
Product list renders loading/empty/error/success
Cart updates quantity and invalidates cart query
Voucher expired shows correct error UI
Checkout prevents double submit
PRICE_CHANGED refreshes cart
INSUFFICIENT_STOCK highlights item
Payment failed allows retry
Admin stock adjustment requires reason
```

E2E flows:

```
register/login
product listing/detail
add to cart
checkout happy path
payment failed retry
COD flow
admin publish product
admin adjust stock
```

---

## 13. Performance Strategy

Frontend performance baseline:

```
Product listing paginated
Images optimized/lazy loaded
Product detail cached short-term
Cart query not over-refetched
Admin tables paginated
Avoid rendering massive lists
```

Rules:

- Do not fetch all products for client-side filtering.
- Do not fetch full order detail for order list.
- Use lightweight DTO for cards/tables.
- Use detail DTO only on detail screen.
- Media should use object storage URL/reference, not binary payload.

---

## 14. Accessibility Baseline

MVP vẫn nên giữ accessibility tối thiểu:

```
button has accessible label
form field has label/error message
keyboard can submit forms
modal can be closed/focused properly
color is not the only status indicator
loading state is announced or visible
```

Critical flows cần accessible:

```
login/register
cart quantity update
checkout form
payment retry
admin destructive confirmation
```

---

## 15. Frontend Delivery Checklist

Before implementing a screen:

```
[ ] Screen goal defined
[ ] Required data listed
[ ] API endpoint mapped
[ ] Loading state defined
[ ] Empty state defined
[ ] Error states mapped by error.code
[ ] Success transition defined
[ ] Cache invalidation rule defined
[ ] Form validation schema defined if needed
[ ] E2E relevance decided
```

Rule:

```
A screen without state design is just a screenshot pretending to be software.
```