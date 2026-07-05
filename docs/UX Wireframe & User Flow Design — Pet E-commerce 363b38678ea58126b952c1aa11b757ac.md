# UX Wireframe & User Flow Design — Pet E-commerce

Trang này mô tả wireframe, user flow và màn hình chính cho Pet E-commerce.

Mục tiêu là giúp frontend, backend và product cùng hiểu customer journey trước khi implement API và UI.

---

## Scope

Wireframe ở mức low-fidelity text-based, đủ để xác định:

- Màn hình chính
- User action
- Data cần hiển thị
- API cần gọi
- State loading/error/empty
- Business rule ảnh hưởng UX

Chi tiết visual design, color, typography và component style không nằm trong scope trang này.

---

## 1. Primary User Roles

### Guest

Người chưa đăng nhập.

Có thể:

- Xem product listing
- Xem product detail
- Search/filter sản phẩm
- Đăng ký
- Đăng nhập

Không nên:

- Checkout
- Quản lý cart persistent nếu chưa có anonymous cart strategy

### Customer

Người đã đăng nhập.

Có thể:

- Quản lý profile
- Quản lý cart
- Apply voucher
- Checkout
- Xem order history
- Theo dõi shipment

### Admin / Backoffice

Người vận hành tenant.

Có thể:

- Quản lý catalog/product
- Quản lý inventory
- Quản lý voucher/discount
- Xem order/payment/shipment
- Cập nhật shipment/COD thủ công khi cần

---

## 2. Customer Main Flow

```
Home
→ Product Listing
→ Product Detail
→ Add To Cart
→ Cart
→ Apply Voucher
→ Checkout
→ Order Created
→ Payment / COD Selection
→ Order Detail
→ Shipment Tracking
```

Critical UX states:

- Product unavailable
- Out of stock
- Voucher invalid
- Price changed before checkout
- Payment pending
- Payment failed
- Shipment delayed
- COD pending collection

---

## 3. Admin Main Flow

```
Admin Login
→ Dashboard
→ Catalog Management
→ Product Management
→ Inventory Management
→ Voucher Management
→ Order Management
→ Payment/Refund Management
→ Shipment Management
```

Admin UX phải ưu tiên auditability:

- Ai thay đổi
- Thay đổi cái gì
- Lý do thay đổi
- Thời điểm thay đổi
- Kết quả event/action

---

## 4. Product Listing Wireframe

### Screen Goal

Cho customer xem danh sách sản phẩm đã publish.

### Layout

```
[Header]
  Logo | Search Bar | Cart Icon | User Menu

[Filter Sidebar]
  Category
  Price Range
  Availability

[Product Grid]
  Product Card
    Image
    Product Name
    Price / Final Price
    Discount Badge optional
    Stock Status optional
    Add To Cart button

[Pagination]
  Previous | Page Number | Next
```

### Required Data

```
productId
name
primaryImage
originalPrice
finalPrice
discountBadge
stockStatus
catalogName
```

### UX States

```
loading
empty result
search no result
product out of stock
failed to load products
```

### API Mapping

```
GET /api/v1/products
GET /api/v1/catalogs
```

---

## 5. Product Detail Wireframe

### Screen Goal

Cho customer xem chi tiết sản phẩm và thêm vào cart.

### Layout

```
[Product Media Gallery]
[Product Info]
  Product Name
  Description
  Attributes
  Price
  Discount Info
  Stock Status
  Quantity Selector
  Add To Cart Button

[Related Products optional]
```

### Required Data

```
productId
name
description
media[]
attributes[]
priceSnapshot
availableStockStatus
```

### UX States

```
product archived
product not found
out of stock
price unavailable
add to cart success
add to cart failed
```

### API Mapping

```
GET /api/v1/products/:productId
POST /api/v1/cart/items
```

---

## 6. Cart Wireframe

### Screen Goal

Cho customer kiểm tra cart, chỉnh quantity, apply voucher và đi tới checkout.

### Layout

```
[Cart Items]
  Product Image
  Product Name
  Price Snapshot
  Quantity Selector
  Item Subtotal
  Remove Button

[Voucher Box]
  Voucher Input
  Apply Button
  Voucher Validation Message

[Cart Summary]
  Subtotal
  Product Discount
  Voucher Discount
  Tax Estimate optional
  Final Amount
  Checkout Button
```

### Required Data

```
cartId
items[]
subtotalAmount
productDiscountAmount
voucherDiscountAmount
finalAmount
appliedVoucher
```

### UX States

```
cart empty
voucher invalid
voucher expired
item unavailable
price changed
checkout disabled
```

### API Mapping

```
GET /api/v1/cart
PATCH /api/v1/cart/items/:itemId
DELETE /api/v1/cart/items/:itemId
POST /api/v1/cart/voucher
POST /api/v1/cart/checkout
```

---

## 7. Checkout Wireframe

### Screen Goal

Customer xác nhận thông tin đơn hàng, địa chỉ, phương thức giao hàng và phương thức thanh toán.

### Layout

```
[Checkout Page]
  Shipping Address Section
    Selected Address
    Change Address Button
    Add New Address Button

  Shipping Method Section
    Shipping Method Options
    Estimated Delivery Time

  Payment Method Section
    Online Payment
    COD

  Order Summary
    Items
    Subtotal
    Product Discount
    Voucher Discount
    Shipping Fee optional
    Tax optional
    Final Amount

  Place Order Button
```

### Required Data

```
cartId
customerId
addresses[]
selectedAddressId
shippingMethods[]
paymentMethods[]
pricingSnapshot
cartItems[]
```

### UX States

```
address missing
shipping method unavailable
cart item unavailable
inventory not enough
price changed
voucher invalid before checkout
payment method unavailable
checkout processing
checkout failed
```

### API Mapping

```
GET /api/v1/cart
GET /api/v1/addresses
POST /api/v1/addresses
POST /api/v1/cart/checkout
```

---

## 8. Order Detail Wireframe

### Screen Goal

Customer xem trạng thái order, payment, invoice và shipment.

### Layout

```
[Order Header]
  Order Code
  Order Status
  Created At

[Payment Section]
  Payment Method
  Payment Status
  Retry Payment Button optional

[Shipment Section]
  Shipment Status
  Tracking Code
  Estimated Delivery

[Order Items]
  Product Name
  Quantity
  Price
  Discount
  Final Price

[Summary]
  Total Amount
  Tax
  Shipping Fee
  Final Amount
```

### Required Data

```
orderId
orderCode
orderStatus
paymentStatus
invoiceId
shipmentStatus
trackingCode
items[]
summary
```

### UX States

```
order pending
payment pending
payment failed
paid waiting shipment
shipping in transit
delivered
cancelled
refund requested
refunded
```

### API Mapping

```
GET /api/v1/orders/:orderId
GET /api/v1/orders/:orderId/invoice
GET /api/v1/orders/:orderId/shipment
```

---

## 9. Shipment Tracking Wireframe

### Screen Goal

Customer theo dõi trạng thái giao hàng.

### Layout

```
[Shipment Tracking]
  Tracking Code
  Current Status
  Carrier Name
  Estimated Delivery

[Tracking Timeline]
  Created
  In Transit
  Delivered
  Failed optional

[COD Section optional]
  COD Amount
  COD Status
```

### Required Data

```
shipmentId
orderId
trackingCode
carrierName
status
timeline[]
codStatus
codAmount
```

### UX States

```
shipment not created yet
tracking unavailable
in transit
delivered
delivery failed
COD pending
COD collected
```

### API Mapping

```
GET /api/v1/orders/:orderId/shipment
GET /api/v1/shipments/:shipmentId
```

---

## 10. Admin Product Management Wireframe

### Screen Goal

Admin quản lý catalog, product base info, attributes, media và publication state.

### Layout

```
[Admin Product List]
  Search
  Catalog Filter
  Status Filter
  Create Product Button

[Product Table]
  Product Name
  Catalog
  Status
  Created At
  Updated At
  Actions

[Product Editor]
  Basic Info
  Catalog Selector
  Attribute Editor
  Media Gallery
  Primary Image Selector
  Publish / Archive Actions
```

### Required Data

```
productId
name
catalogId
catalogName
status
primaryImage
attributes[]
media[]
createdAt
updatedAt
```

### UX States

```
product draft
product published
product archived
primary image missing
catalog missing
publish validation failed
```

### API Mapping

```
GET /api/v1/products
POST /api/v1/products
PATCH /api/v1/products/:productId
POST /api/v1/products/:productId/publish
POST /api/v1/products/:productId/archive
POST /api/v1/products/:productId/media
POST /api/v1/products/:productId/attributes
```

---

## 11. Admin Inventory Management Wireframe

### Screen Goal

Admin quản lý stock, reserved quantity và stock adjustment.

### Layout

```
[Inventory List]
  Product Search
  Warehouse Filter optional
  Low Stock Filter

[Inventory Table]
  Product Name
  Quantity
  Reserved Quantity
  Available Quantity
  Status
  Adjust Button

[Adjust Stock Modal]
  Adjustment Type
  Quantity Delta
  Reason
  Confirm Button
```

### Required Data

```
productId
productName
quantity
reservedQuantity
availableQuantity
status
lastAdjustedAt
```

### UX States

```
low stock
out of stock
reserved quantity exceeded
adjustment requires reason
concurrent stock update detected
```

### API Mapping

```
GET /api/v1/inventory/:productId
GET /api/v1/inventory/low-stock
POST /api/v1/inventory/:productId/adjust
```

---

## 12. Admin Order Operations Wireframe

### Screen Goal

Admin theo dõi order lifecycle, payment, shipment và refund state.

### Layout

```
[Order Dashboard]
  Status Filter
  Payment Status Filter
  Date Range Filter
  Search by Order Code

[Order Table]
  Order Code
  Customer
  Total Amount
  Order Status
  Payment Status
  Shipment Status
  Created At
  Actions

[Order Detail Admin]
  Order Summary
  Payment Section
  Shipment Section
  Refund Section
  Audit Timeline
```

### Required Data

```
orderId
orderCode
customerId
customerEmail
totalAmount
orderStatus
paymentStatus
shipmentStatus
createdAt
auditEvents[]
```

### UX States

```
order pending payment
order paid
order shipping
order delivered
payment failed
refund requested
refund completed
manual action requires reason
```

### API Mapping

```
GET /api/v1/admin/orders
GET /api/v1/admin/orders/:orderId
POST /api/v1/admin/orders/:orderId/cancel
POST /api/v1/refunds
PATCH /api/v1/shipments/:shipmentId/status
```

---

## 13. Global UX State Convention

Mọi screen nên định nghĩa các state tối thiểu:

```
loading
empty
error
success
permission denied
validation failed
stale data
retry available
```

Error UI phải dựa trên `error.code`, không parse message.

Ví dụ:

```
VOUCHER_EXPIRED -> show expired voucher message
INSUFFICIENT_STOCK -> show stock unavailable message
PAYMENT_AMOUNT_MISMATCH -> show payment verification failed message
TENANT_ACCESS_DENIED -> show permission/access denied message
```

---

## 14. UX/API Alignment Rule

Mỗi screen phải trả lời được:

```
Screen cần data gì?
Data đến từ API nào?
State loading/error/empty là gì?
User action gọi command nào?
Command có thể fail với error code nào?
Sau success thì UI chuyển state ra sao?
```

Nếu screen không trả lời được các câu này, chưa nên implement UI.