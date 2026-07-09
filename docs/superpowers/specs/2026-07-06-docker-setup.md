# Docker Setup — Phase 1A

**Date:** 2026-07-06
**Status:** Approved
**Phase:** 1A (Foundation)

---

## Purpose

Provide Docker Compose configuration for PostgreSQL instances used by the Pet E-commerce platform. Each bounded context gets its own database instance to enforce data isolation at the infrastructure level.

---

## Design

### Service Per Bounded Context

Each bounded context maps to a separate PostgreSQL 16 Alpine container:

| Context | Service Name | Container Name | Host Port | DB Name |
|---------|-------------|----------------|-----------|---------|
| Auth (current) | `postgres_auth` | `pet-postgres-auth` | `5432` | `ddd_auth` |
| User (Phase 1D) | `postgres_user` | `pet-postgres-user` | `5433` | `ddd_user` |
| Product Catalog (Phase 2) | `postgres_catalog` | `pet-postgres-catalog` | `5434` | `ddd_catalog` |
| Shipping (Phase 3) | `postgres_shipping` | `pet-postgres-shipping` | `5435` | `ddd_shipping` |
| Order (Phase 4+) | `postgres_order` | `pet-postgres-order` | `5436` | `ddd_order` |
| Inventory (Phase 4+) | `postgres_inventory` | `pet-postgres-inventory` | `5437` | `ddd_inventory` |
| Payment (Phase 4+) | `postgres_payment` | `pet-postgres-payment` | `5438` | `ddd_payment` |

### docker-compose.yml

```yaml
version: '3.8'

services:
  postgres_auth:
    image: postgres:16-alpine
    container_name: pet-postgres-auth
    ports:
      - "${DB_AUTH_PORT:-5432}:5432"
    environment:
      POSTGRES_DB: ${DB_AUTH_DATABASE:-ddd_auth}
      POSTGRES_USER: ${DB_AUTH_USERNAME:-postgres}
      POSTGRES_PASSWORD: ${DB_AUTH_PASSWORD:-postgres}
    volumes:
      - pgdata_auth:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_AUTH_USERNAME:-postgres} -d ${DB_AUTH_DATABASE:-ddd_auth}"]
      interval: 5s
      timeout: 3s
      retries: 5

  postgres_user:
    image: postgres:16-alpine
    container_name: pet-postgres-user
    ports:
      - "${DB_USER_PORT:-5433}:5432"
    environment:
      POSTGRES_DB: ${DB_USER_DATABASE:-ddd_user}
      POSTGRES_USER: ${DB_USER_USERNAME:-postgres}
      POSTGRES_PASSWORD: ${DB_USER_PASSWORD:-postgres}
    volumes:
      - pgdata_user:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER_USERNAME:-postgres} -d ${DB_USER_DATABASE:-ddd_user}"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  pgdata_auth:
  pgdata_user:
```

> **Note:** `postgres_user` is defined now but unused until Phase 1D (User Context). It is included to avoid docker-compose structural changes later. Phase 2+ will append their service blocks to this same file.

### Environment Variables (.env.example additions)

```env
# Database — Auth
DB_AUTH_PORT=5432
DB_AUTH_DATABASE=ddd_auth
DB_AUTH_USERNAME=postgres
DB_AUTH_PASSWORD=postgres

# Database — User (Phase 1D)
DB_USER_PORT=5433
DB_USER_DATABASE=ddd_user
DB_USER_USERNAME=postgres
DB_USER_PASSWORD=postgres
```

### Commands

```bash
# Start all DBs
docker compose up -d

# Start specific service
docker compose up -d postgres_auth

# Stop all
docker compose down

# Logs
docker compose logs -f

# Status
docker compose ps

# Reset a DB volume
docker compose down -v && docker compose up -d
```

---

## Files Affected

| Action | File | Description |
|--------|------|-------------|
| Create | `docker-compose.yml` | Docker Compose at project root |
| Modify | `backend/.env.example` | Add DB_AUTH_*, DB_USER_* env vars |
| Modify | `README.md` | Add Docker quick start section |
| Modify | `backend/src/shared/adapters/config/app.config.ts` | Update DB config to use per-context env vars (optional, backward-compatible) |

---

## Non-Goals (YAGNI)

- ❌ App containerization (app runs via `pnpm start:dev` outside Docker)
- ❌ Multi-stage builds
- ❌ Docker networks other than default bridge
- ❌ Docker Compose profiles
- ❌ Container for Redis / RabbitMQ / worker
- ❌ Kubernetes / Swarm

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│  Host Machine (pnpm start:dev on :3001)              │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ App Process  │  │ App Process  │  │ App Process │ │
│  │ (Auth BC)    │  │ (User BC)    │  │ (Phase 2+)  │ │
│  │ port 5432    │  │ port 5433    │  │ port 5434+  │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │
│         │                │                 │         │
└─────────┼────────────────┼─────────────────┼─────────┘
          │                │                 │
          ▼                ▼                 ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ postgres:16-alp  │ │ postgres:16-alp  │ │ postgres:16-alp  │
│ container        │ │ container        │ │ container        │
│ (pet-postgres-   │ │ (pet-postgres-   │ │ (pet-postgres-   │
│  auth)           │ │  user)           │ │  catalog/...)    │
│ Volume: pgdata_   │ │ Volume: pgdata_   │ │ Volume: pgdata_   │
│ auth             │ │ user             │ │ <context>       │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## Spec Self-Review

- ✅ No placeholders or TODOs
- ✅ Scope focused on Docker setup only
- ✅ Each BC maps to one DB instance
- ✅ Port numbering predictable (5432 + offset)
- ✅ Env vars use per-context prefix
- ✅ Non-goals explicitly excluded
- ✅ Commands documented
