---
name: feature-rbac-is-not-optional
description: With FEATURE_RBAC off, all eleven @Roles(ROLE_ADMIN) endpoints accept any authenticated caller
metadata:
  type: project
---

`RolesGuard` returns `true` immediately when `app.features.rbac` is false. It
defaulted to false, so **eleven `@Roles(ROLE_ADMIN)` endpoints** — every
catalog and product write, and the role-promotion endpoint itself — accepted
any authenticated caller.

A feature flag that turns *off* an authorization check is not a feature flag,
it is a switch labelled "enforce security", and its safe default is on.

Two things follow:

- `FEATURE_RBAC=true` in `.env.example`, documented as required.
- **Seed an admin first** (`pnpm seed:admin`). Registration cannot grant a role
  and the promote endpoint needs an admin, so switching RBAC on with no admin
  in the database locks those endpoints against everyone, permanently.

The same shape is worth checking for `FEATURE_ABAC`: `AttributesGuard` is a
skeleton and no route uses `@Attributes()`, so it is inert either way today.
