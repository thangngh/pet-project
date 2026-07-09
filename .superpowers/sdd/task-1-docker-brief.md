## Task 1: Create docker-compose.yml

**Goal:** Create the Docker Compose file at project root to provision per-BC PostgreSQL instances.

**File to create:** `E:\pet-project\ddd\docker-compose.yml`

**Content (exact):**
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

**Steps:**
1. Create file at exact path
2. Verify: `docker compose config` prints valid config
3. Commit: `feat: add docker-compose.yml with per-BC PostgreSQL services`
