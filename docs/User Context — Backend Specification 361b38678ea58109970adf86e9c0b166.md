# User Context — Backend Specification

Trang con này chứa chi tiết backend specification cho User Context.

Nội dung được tách thành sub-page để dễ bảo trì và tránh payload lớn làm Notion update timeout.

---

## 1. Purpose

User Context quản lý user profile, user identity, authentication session và các hành vi cơ bản của customer/admin trong một tenant.

Ở giai đoạn MVP, context này chỉ tập trung vào:

- User profile
- User identity
- Authentication
- Session lifecycle
- Tenant-aware access

Không triển khai RBAC/ABAC full ở giai đoạn này. Những phần đó có thể tách thành IAM / Authorization Context sau khi MVP ổn định.

---

## 2. Owned Data

User Context sở hữu:

- UserProfile
- UserIdentity
- UserSession
- Authentication state

User Context không sở hữu:

- Role
- Permission
- Tenant billing
- Order
- Cart
- Address

Address được đặt ở Shipping/Address flow tùy thiết kế triển khai, không trộn trực tiếp vào User aggregate ở giai đoạn này.

---

## 3. Functional Groups

### User Profile Management

- Register user
- Get current user profile
- Update profile
- Activate user
- Block user

### Identity Management

- Create email identity
- Validate password
- Change password
- Reset password placeholder for future phase

### Authentication Session

- Login
- Logout
- Refresh token
- Revoke session

### Tenant-Aware Access

- Resolve tenant from auth context
- Ensure user belongs to tenant
- Prevent cross-tenant access

---

## 4. Aggregate

```
UserProfile (Aggregate Root)
 ├── UserIdentity
 └── UserSession
```

UserProfile là aggregate root đại diện cho user trong một tenant.

UserIdentity đại diện cho thông tin đăng nhập, ví dụ email/password hoặc provider identity.

UserSession đại diện cho phiên đăng nhập hiện tại hoặc refresh token lifecycle.

Ở MVP, một user thuộc một tenant chính. Multi-tenant membership phức tạp có thể tách sang Tenant / Membership Context sau.

---

## 5. Domain Types

```tsx
type UserStatus = "active" | "blocked" | "pending"

type IdentityProvider = "email" | "google" | "facebook"

type IdentityType = "password" | "oauth"

interface UserProfile {
  id: string
  tenantId: string
  firstName: string
  lastName: string
  email: string
  phoneNumber?: string
  username?: string
  avatar?: string
  status: UserStatus
  createdAt: Date
  updatedAt: Date
  version: number
}

interface UserIdentity {
  id: string
  tenantId: string
  userId: string
  identify: string
  provider: IdentityProvider
  type: IdentityType
  passwordHash?: string
  createdAt: Date
  updatedAt: Date
}

interface UserSession {
  id: string
  tenantId: string
  userId: string
  refreshTokenHash: string
  userAgent?: string
  ip?: string
  expiresAt: Date
  revokedAt?: Date
  createdAt: Date
}
```

---

## 6. Use Cases

### RegisterUser

Actor:

```
Guest
```

Validation:

- Tenant must be resolved before registration.
- Email is required.
- Password is required for email identity.
- Email must be unique within tenant.
- Password must satisfy password policy.

Published Events:

```
UserRegistered
```

Failure Cases:

```
USER_EMAIL_EXISTS
INVALID_PASSWORD_POLICY
TENANT_NOT_FOUND
```

---

### Login

Actor:

```
Guest
```

Validation:

- Tenant must be resolved.
- Identity must exist.
- Password must match password hash.
- User must not be blocked.

Transaction Boundary:

- Create new UserSession.
- Store refresh token hash.
- Return access token and refresh token.

Published Events:

```
UserLoggedIn
```

Failure Cases:

```
INVALID_CREDENTIALS
USER_BLOCKED
TENANT_ACCESS_DENIED
```

---

### UpdateProfile

Actor:

```
Authenticated User
```

Validation:

- User must exist.
- User must belong to tenant.
- Email cannot be changed through this use case.
- Optional fields must satisfy format rules.

Published Events:

```
UserProfileUpdated
```

Failure Cases:

```
USER_NOT_FOUND
INVALID_PROFILE_DATA
TENANT_ACCESS_DENIED
```

---

### RefreshToken

Actor:

```
Authenticated Session
```

Validation:

- Refresh token must exist.
- Refresh token hash must match stored session.
- Session must not be expired.
- Session must not be revoked.
- User must not be blocked.

Transaction Boundary:

- Rotate refresh token.
- Update UserSession.
- Return new access token and refresh token.

Published Events:

```
UserSessionRefreshed
```

Failure Cases:

```
INVALID_REFRESH_TOKEN
SESSION_EXPIRED
SESSION_REVOKED
USER_BLOCKED
```

---

### ChangePassword

Actor:

```
Authenticated User
```

Validation:

- User must exist.
- Old password must match current password hash.
- New password must satisfy password policy.
- New password must not equal old password.

Transaction Boundary:

- Update password hash.
- Revoke existing sessions except current session, depending on security policy.

Published Events:

```
UserPasswordChanged
```

Failure Cases:

```
USER_NOT_FOUND
INVALID_OLD_PASSWORD
INVALID_PASSWORD_POLICY
PASSWORD_REUSED
```

---

## 7. Events

```tsx
interface UserRegisteredPayload {
  userId: string
  email: string
  firstName: string
  lastName: string
}

interface UserLoggedInPayload {
  userId: string
  sessionId: string
  occurredAt: string
}

interface UserProfileUpdatedPayload {
  userId: string
  changedFields: string[]
}

interface UserPasswordChangedPayload {
  userId: string
  changedAt: string
}
```

---

## 8. Repository Interfaces

```tsx
interface UserProfileRepository {
  save(user: UserProfile): Promise<void>
  findById(tenantId: string, userId: string): Promise<UserProfile | null>
  findByEmail(tenantId: string, email: string): Promise<UserProfile | null>
}

interface UserIdentityRepository {
  save(identity: UserIdentity): Promise<void>
  findByIdentify(tenantId: string, identify: string, provider: IdentityProvider): Promise<UserIdentity | null>
}

interface UserSessionRepository {
  save(session: UserSession): Promise<void>
  findByRefreshTokenHash(tenantId: string, refreshTokenHash: string): Promise<UserSession | null>
  revokeByUserId(tenantId: string, userId: string, exceptSessionId?: string): Promise<void>
}
```

---

## 9. HTTP API

```
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh-token
POST /api/v1/auth/logout
POST /api/v1/auth/change-password

GET   /api/v1/me
PATCH /api/v1/me/profile
```

Mapping:

```
POST /api/v1/auth/register -> RegisterUser
POST /api/v1/auth/login -> Login
POST /api/v1/auth/refresh-token -> RefreshToken
POST /api/v1/auth/change-password -> ChangePassword
GET /api/v1/me -> GetCurrentUserProfile
PATCH /api/v1/me/profile -> UpdateProfile
```

---

## 10. Test Checklist

```
[ ] Register user succeeds with unique email in tenant
[ ] Duplicate email in same tenant fails
[ ] Same email in different tenant is allowed if tenant-local identity is enabled
[ ] Login succeeds with valid credential
[ ] Login fails for blocked user
[ ] Refresh token rotates token
[ ] Revoked session cannot refresh token
[ ] Change password requires valid old password
[ ] Change password can revoke existing sessions
[ ] Update profile cannot change email
[ ] Tenant mismatch returns TENANT_ACCESS_DENIED
```