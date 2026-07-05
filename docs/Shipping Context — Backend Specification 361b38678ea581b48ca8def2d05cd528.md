# Shipping Context — Backend Specification

Trang con này chứa chi tiết backend specification cho Shipping Context.

Nội dung được tách thành sub-page để tránh payload lớn làm Notion update timeout.

---

## 1. Purpose

Shipping Context quản lý địa chỉ giao hàng, shipment lifecycle, carrier tracking và COD collection.

Shipping Context không sở hữu Order, User hoặc Payment. Các field như `orderId`, `customerId`, `invoiceId` chỉ là business reference.

---

## 2. Owned Data

Shipping Context sở hữu:

- CustomerAddress
- Shipment
- ShipmentTrackingEvent
- COD
- Delivery state

Shipping Context không sở hữu:

- Order
- Invoice
- Payment
- User
- Product

---

## 3. Functional Groups

### Address Management

- Create address
- Update address
- Delete address
- Set default address
- Get customer addresses

### Shipment Management

- Create shipment
- Update shipment status
- Track shipment
- Mark delivery failed
- Mark delivered

### COD Management

- Create COD record
- Confirm COD collected
- Mark COD failed

---

## 4. Aggregate

```
Shipment (Aggregate Root)
 ├── ShipmentTrackingEvent
 └── COD
```

Shipment là transaction boundary cho trạng thái vận chuyển.

CustomerAddress có thể là aggregate riêng nếu cần quản lý lifecycle độc lập.

---

## 5. Domain Types

```tsx
type ShipmentStatus =
  | "pending"
  | "created"
  | "in_transit"
  | "delivered"
  | "failed"
  | "cancelled"

type CODStatus = "pending" | "collected" | "failed" | "cancelled"

interface Shipment {
  id: string
  tenantId: string
  orderId: string
  customerId: string
  addressId: string
  shippingMethod: string
  trackingCode?: string
  status: ShipmentStatus
  createdAt: Date
  updatedAt: Date
  version: number
}

interface COD {
  id: string
  tenantId: string
  shipmentId: string
  orderId: string
  amount: number
  status: CODStatus
  collectedAt?: Date
}
```

---

## 6. Use Cases

### CreateShipment

Trigger:

```
OrderConfirmed event or PaymentSucceeded event, depending on selected flow
```

Validation:

- Order reference must exist in event payload.
- Shipment must not already exist for orderId.
- Address reference must be provided.
- Shipping method must be supported.

Published Events:

```
ShipmentCreated
```

Failure Cases:

```
SHIPMENT_ALREADY_EXISTS
INVALID_SHIPPING_ADDRESS
INVALID_SHIPPING_METHOD
TENANT_ACCESS_DENIED
IDEMPOTENCY_CONFLICT
```

---

### UpdateShipmentStatus

Trigger:

```
Carrier webhook or Admin action
```

Validation:

- Shipment must exist.
- Status transition must be valid.
- Carrier event must be idempotent.

Published Events:

```
ShipmentStatusChanged
ShipmentDelivered
DeliveryFailed
```

Failure Cases:

```
SHIPMENT_NOT_FOUND
INVALID_SHIPMENT_STATE
INVALID_CARRIER_EVENT
IDEMPOTENCY_CONFLICT
```

---

### ConfirmCODCollected

Trigger:

```
Carrier webhook or Admin action
```

Validation:

- Shipment must exist.
- COD record must exist.
- Shipment must be delivered.
- COD status must be pending.
- Collected amount must match COD amount.

Published Events:

```
CODCollected
```

Failure Cases:

```
SHIPMENT_NOT_FOUND
COD_NOT_FOUND
COD_ALREADY_COLLECTED
COD_AMOUNT_MISMATCH
INVALID_SHIPMENT_STATE
```

---

## 7. Events

```tsx
interface ShipmentCreatedPayload {
  shipmentId: string
  orderId: string
  customerId: string
  addressId: string
  shippingMethod: string
  trackingCode?: string
}

interface ShipmentDeliveredPayload {
  shipmentId: string
  orderId: string
  deliveredAt: string
}

interface DeliveryFailedPayload {
  shipmentId: string
  orderId: string
  reason: string
}

interface CODCollectedPayload {
  shipmentId: string
  orderId: string
  amount: number
  collectedAt: string
}
```

---

## 8. Repository Interfaces

```tsx
interface ShipmentRepository {
  save(shipment: Shipment): Promise<void>
  findById(tenantId: string, shipmentId: string): Promise<Shipment | null>
  findByOrderId(tenantId: string, orderId: string): Promise<Shipment | null>
}

interface CODRepository {
  save(cod: COD): Promise<void>
  findByShipmentId(tenantId: string, shipmentId: string): Promise<COD | null>
}
```

---

## 9. HTTP API

```
GET    /api/v1/addresses
POST   /api/v1/addresses
PATCH  /api/v1/addresses/:addressId
DELETE /api/v1/addresses/:addressId
POST   /api/v1/addresses/:addressId/default

GET    /api/v1/shipments/:shipmentId
GET    /api/v1/orders/:orderId/shipment
POST   /api/v1/shipments/webhook/:provider
PATCH  /api/v1/shipments/:shipmentId/status
POST   /api/v1/shipments/:shipmentId/cod/collect
```

Mapping:

```
POST /api/v1/addresses -> CreateAddress
PATCH /api/v1/addresses/:addressId -> UpdateAddress
POST /api/v1/addresses/:addressId/default -> SetDefaultAddress
POST /api/v1/shipments/webhook/:provider -> UpdateShipmentStatus / ConfirmCODCollected
POST /api/v1/shipments/:shipmentId/cod/collect -> ConfirmCODCollected
```

Carrier webhook endpoint phải idempotent.

---

## 10. Test Checklist

```
[ ] CreateShipment from event succeeds
[ ] Duplicate event does not create duplicate shipment
[ ] Invalid address fails shipment creation
[ ] Shipment status transition is validated
[ ] Carrier webhook is idempotent
[ ] Delivered shipment emits ShipmentDelivered
[ ] Failed delivery emits DeliveryFailed
[ ] CODCollected requires delivered shipment
[ ] Duplicate COD collection is rejected or idempotent
[ ] COD amount mismatch fails
[ ] Tenant mismatch returns TENANT_ACCESS_DENIED
```