# Docker Setup — Phase 1A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provision PostgreSQL 16 Alpine containers per bounded context via Docker Compose.

**Architecture:** One database service per BC (Auth, User, Catalog, etc.), each with isolated volume and port offset. App runs on host via `pnpm start:dev` — no app containerization.

**Tech Stack:** Docker Compose 3.8, PostgreSQL 16 Alpine, `.env` variable passthrough.

## Global Constraints

- **Port convention:** Auth = 5432, User = 5433, Catalog = 5434, Shipping = 5435, Order = 5436, Inventory = 5437, Payment = 5438.
- **Env prefix:** `DB_<CONTEXT>_*` for all database variables.
- **Container name:** `pet-postgres-<context>` (kebab-case).
- **Service name:** `postgres_<context>` (snake_case).
- **Volume name:** `pgdata_<context>`.
- **No app containerization** — app runs outside Docker.
- **Compile:** `pnpm build` must pass after config changes.

---

### Task 1: Create docker-compose.yml

**Files:**
- Create: `E:\pet-project\ddd\docker-compose.yml`

**Interfaces:**
- Produces: `docker-compose.yml` consumed by `docker compose up` commands in Tasks 3, 4, 6.

- [ ] **Step 1: Write docker-compose.yml**

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

- [ ] **Step 2: Verify syntax**

Run: `docker compose config`
Expected: prints validated compose config, no errors.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add docker-compose.yml with per-BC PostgreSQL services"
```

---

### Task 2: Update .env.example with DB variables

**Files:**
- Modify: `E:\pet-project\ddd\backend\.env.example`

- [ ] **Step 1: Append per-context DB env vars**

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

# Database — Product Catalog (Phase 2)
DB_CATALOG_PORT=5434
DB_CATALOG_DATABASE=ddd_catalog
DB_CATALOG_USERNAME=postgres
DB_CATALOG_PASSWORD=postgres
```

Add these below the existing `# Database` block or create a new `# Database — Per Context` section.

- [ ] **Step 2: Commit**

```bash
git add backend/.env.example
git commit -m "chore: add per-context DB env vars"
```

---

### Task 3: Update README.md with Docker Quick Start

**Files:**
- Modify: `E:\pet-project\ddd\README.md`

- [ ] **Step 1: Add Docker section after Quick Start**

```markdown
## Docker

PostgreSQL instances run via Docker Compose, one per bounded context.

```bash
# Start all databases
docker compose up -d

# Start a specific service
docker compose up -d postgres_auth

# Stop all
docker compose down

# View logs
docker compose logs -f

# Check status
docker compose ps
```

**Port mapping:**

| Context | Service | Port |
|---------|---------|------|
| Auth | `postgres_auth` | 5432 |
| User | `postgres_user` | 5433 |
| Product Catalog | `postgres_catalog` | 5434 |
| Shipping | `postgres_shipping` | 5435 |
| (future) | ... | 5436+ |
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add Docker quick start to README"
```

---

### Task 4: Update CLAUDE.md with Docker commands

**Files:**
- Modify: `E:\pet-project\ddd\CLAUDE.md`

- [ ] **Step 1: Add Docker commands under the Commands section**

```markdown
# Docker
docker compose up -d              # Start all PostgreSQL services
docker compose up -d postgres_auth # Start specific service
docker compose down               # Stop all
docker compose down -v            # Stop and delete volumes (reset data)
docker compose logs -f            # Follow logs
docker compose ps                 # Service status
```

Insert after the `# Lint` block, before `## Architecture`.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add Docker commands to CLAUDE.md"
```

---

### Task 5: Update app.config.ts for per-context DB config

**Files:**
- Modify: `E:\pet-project\ddd\backend\src\shared\adapters\config\app.config.ts`

**Interfaces:**
- Consumes: `DB_<CONTEXT>_*` env vars from Task 2.
- Produces: per-context DB config consumed by TypeORM modules in Auth (current) and User (Phase 1D).

- [ ] **Step 1: Add per-context database configuration**

```ts
// Inside the database block, restructure to:
database: {
  auth: {
    host: process.env.DB_AUTH_HOST || 'localhost',
    port: parseInt(process.env.DB_AUTH_PORT, 10) || 5432,
    username: process.env.DB_AUTH_USERNAME || 'postgres',
    password: process.env.DB_AUTH_PASSWORD || 'postgres',
    database: process.env.DB_AUTH_DATABASE || 'ddd_auth',
  },
  user: {
    host: process.env.DB_USER_HOST || 'localhost',
    port: parseInt(process.env.DB_USER_PORT, 10) || 5433,
    username: process.env.DB_USER_USERNAME || 'postgres',
    password: process.env.DB_USER_PASSWORD || 'postgres',
    database: process.env.DB_USER_DATABASE || 'ddd_user',
  },
},
```

- [ ] **Step 2: Verify backward compatibility** — existing `DB_HOST` / `DB_PORT` etc. remain for the shared TypeORM root config. The per-context configs are additive, not breaking.

- [ ] **Step 3: Run build**

Run: `cd backend && pnpm build`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/shared/adapters/config/app.config.ts
git commit -m "feat: add per-context database config"
```

---

### Task 6: Start DBs and verify

- [ ] **Step 1: Start all services**

Run: `docker compose up -d`
Expected: containers `pet-postgres-auth` and `pet-postgres-user` show `Up` in `docker compose ps`

- [ ] **Step 2: Check health**

Run: `docker compose ps`
Expected: both containers `Up` (healthy)

- [ ] **Step 3: Connect to auth database**

Run: `docker compose exec postgres_auth pg_isready -U postgres -d ddd_auth`
Expected: `localhost:5432 - accepting connections`

- [ ] **Step 4: Connect to user database**

Run: `docker compose exec postgres_user pg_isready -U postgres -d ddd_user`
Expected: `localhost:5432 (inside container) - accepting connections`

- [ ] **Step 5: Test host connectivity**

Run: `cd backend && npx typeorm query "SELECT 1"` or `psql -h localhost -p 5432 -U postgres -d ddd_auth -c "SELECT 1"`
Expected: returns `1`

- [ ] **Step 6: Stop services**

Run: `docker compose down`
Expected: containers removed

---

### Task 7: Final commit & push

- [ ] **Step 1: Verify all changes committed**

Run: `git status`
Expected: `nothing to commit, working tree clean`

- [ ] **Step 2: Push to remote**

```bash
git push origin main
```

---

## Self-Review

**1. Spec coverage:**
- ✅ Per-BC PostgreSQL instances — Task 1
- ✅ Port numbering (5432 + offset) — Task 1
- ✅ Env vars per context — Task 2
- ✅ README quick start — Task 3
- ✅ CLAUDE.md commands — Task 4
- ✅ Config update — Task 5
- ✅ No app containerization — enforced by task scope
- ✅ Healthcheck — Task 1 yml, Task 6 verification

**2. Placeholder scan:** No TBDs, TODOs, or vague instructions.

**3. Type consistency:**
- Env var names: `DB_AUTH_PORT`, `DB_USER_PORT` consistent across Tasks 1, 2, 5.
- Service names: `postgres_auth`, `postgres_user` consistent across Tasks 1, 3, 4, 6.
