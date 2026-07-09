# Pet E-commerce

DDD + Hexagonal Architecture (Ports & Adapters) — Monolithic NestJS 10 API

## Structure

```
├── backend/         # Source code (see backend/README.md)
│   ├── src/         # Application code
│   ├── test/        # E2E tests
│   ├── package.json
│   └── ...
├── docs/            # Design specs, ADRs, gates, strategies
├── CLAUDE.md        # AI coding agent instructions
├── docker-compose.yml  # PostgreSQL per bounded context
└── LICENSE          # License terms
```

## License

**Commercial use** requires a paid license.
**Module use** requires public fork of modified source.

See [LICENSE](./LICENSE) for full terms.

## Quick Start

```bash
cd backend
cp .env.example .env
pnpm install
pnpm start:dev
```

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
